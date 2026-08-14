import { google } from "googleapis";
import { getAuthClient, assertWriteEnabled } from "../auth/service-account.js";
import { getGa4Tags, listGtmTriggers } from "./tagmanager-api.js";

let tagmanagerClient: ReturnType<typeof google.tagmanager> | null = null;

async function getClient() {
  if (tagmanagerClient) return tagmanagerClient;
  const auth = await getAuthClient();
  tagmanagerClient = google.tagmanager({ version: "v2", auth: auth as any });
  return tagmanagerClient;
}

function workspacePath(accountId: string, containerId: string, workspaceId: string) {
  return `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
}

function validateEventName(eventName: string) {
  if (!eventName || typeof eventName !== "string") {
    throw new Error("eventName is required");
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(eventName)) {
    throw new Error(
      `Invalid eventName "${eventName}": must start with a letter, contain only [A-Za-z0-9_], max 40 chars`
    );
  }
}

/**
 * Create a Custom Event trigger in a GTM workspace.
 */
export async function createCustomEventTrigger(params: {
  accountId: string;
  containerId: string;
  workspaceId: string;
  eventName: string;
  triggerName?: string;
  dryRun?: boolean;
  confirm?: boolean;
}) {
  assertWriteEnabled();
  const {
    accountId,
    containerId,
    workspaceId,
    eventName,
    triggerName,
    dryRun = false,
    confirm = false,
  } = params;

  validateEventName(eventName);

  if (!confirm && !dryRun) {
    throw new Error(
      "Safety check: pass confirm=true to create a trigger, or dryRun=true to preview the payload."
    );
  }

  const name = triggerName || `CE - ${eventName}`;

  // Avoid duplicates
  const existing = await listGtmTriggers(accountId, containerId, workspaceId);
  const duplicate = existing.triggers.find(
    (t: any) => t.name === name || (t.type === "CUSTOM_EVENT" && t.name.includes(eventName))
  );

  const payload = {
    name,
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: eventName },
        ],
      },
    ],
  };

  if (dryRun) {
    return {
      dryRun: true,
      wouldCreate: payload,
      duplicateFound: duplicate
        ? { triggerId: duplicate.triggerId, name: duplicate.name }
        : null,
    };
  }

  if (duplicate) {
    return {
      created: false,
      reason: "Trigger already exists",
      existing: { triggerId: duplicate.triggerId, name: duplicate.name },
    };
  }

  const client = await getClient();
  const parent = workspacePath(accountId, containerId, workspaceId);
  const res = await client.accounts.containers.workspaces.triggers.create({
    parent,
    requestBody: payload,
  });

  return {
    created: true,
    trigger: {
      triggerId: res.data.triggerId,
      name: res.data.name,
      type: res.data.type,
      path: res.data.path,
    },
    note: "Trigger created in workspace only — not published. Use GTM UI Preview then Publish.",
  };
}

/**
 * Create a GA4 Event tag (type gaawe) in a GTM workspace.
 */
export async function createGa4EventTag(params: {
  accountId: string;
  containerId: string;
  workspaceId: string;
  eventName: string;
  tagName?: string;
  measurementId?: string;
  parameters?: Array<{ key: string; value: string }>;
  firingTriggerIds?: string[];
  dryRun?: boolean;
  confirm?: boolean;
}) {
  assertWriteEnabled();
  const {
    accountId,
    containerId,
    workspaceId,
    eventName,
    tagName,
    measurementId,
    parameters = [],
    firingTriggerIds = [],
    dryRun = false,
    confirm = false,
  } = params;

  validateEventName(eventName);

  if (!confirm && !dryRun) {
    throw new Error(
      "Safety check: pass confirm=true to create a tag, or dryRun=true to preview the payload."
    );
  }

  const name = tagName || `GA4 - ${eventName}`;

  // Check duplicates
  const existing = await getGa4Tags(accountId, containerId, workspaceId);
  const duplicate = existing.tags.find(
    (t: any) => t.eventName === eventName || t.name === name
  );

  const tagParameters: any[] = [
    { type: "TEMPLATE", key: "eventName", value: eventName },
  ];

  if (measurementId) {
    tagParameters.push({
      type: "TEMPLATE",
      key: "measurementIdOverride",
      value: measurementId,
    });
  }

  // Event parameters list (GA4 Event tag format)
  if (parameters.length > 0) {
    tagParameters.push({
      type: "LIST",
      key: "eventParameters",
      list: parameters.map((p) => ({
        type: "MAP",
        map: [
          { type: "TEMPLATE", key: "name", value: p.key },
          { type: "TEMPLATE", key: "value", value: p.value },
        ],
      })),
    });
  }

  const payload: any = {
    name,
    type: "gaawe",
    parameter: tagParameters,
    firingTriggerId: firingTriggerIds,
  };

  if (dryRun) {
    return {
      dryRun: true,
      wouldCreate: payload,
      duplicateFound: duplicate
        ? { tagId: duplicate.tagId, name: duplicate.name, eventName: duplicate.eventName }
        : null,
    };
  }

  if (duplicate) {
    return {
      created: false,
      reason: "A GA4 Event tag for this event already exists",
      existing: {
        tagId: duplicate.tagId,
        name: duplicate.name,
        eventName: duplicate.eventName,
      },
    };
  }

  const client = await getClient();
  const parent = workspacePath(accountId, containerId, workspaceId);
  const res = await client.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: payload,
  });

  return {
    created: true,
    tag: {
      tagId: res.data.tagId,
      name: res.data.name,
      type: res.data.type,
      path: res.data.path,
      firingTriggerId: res.data.firingTriggerId || [],
    },
    note: "Tag created in workspace only — not published. Use GTM UI Preview then Publish.",
  };
}

/**
 * One-shot: create Custom Event trigger + GA4 Event tag, linked together.
 */
export async function createGa4EventSetup(params: {
  accountId: string;
  containerId: string;
  workspaceId: string;
  eventName: string;
  measurementId?: string;
  parameters?: Array<{ key: string; value: string }>;
  tagName?: string;
  triggerName?: string;
  dryRun?: boolean;
  confirm?: boolean;
}) {
  assertWriteEnabled();
  const {
    accountId,
    containerId,
    workspaceId,
    eventName,
    measurementId,
    parameters,
    tagName,
    triggerName,
    dryRun = false,
    confirm = false,
  } = params;

  validateEventName(eventName);

  if (!confirm && !dryRun) {
    throw new Error(
      "Safety check: pass confirm=true to create the setup, or dryRun=true to preview."
    );
  }

  // 1. Trigger
  const triggerResult = await createCustomEventTrigger({
    accountId,
    containerId,
    workspaceId,
    eventName,
    triggerName,
    dryRun,
    confirm: true, // already gated above
  });

  if (dryRun) {
    const tagPreview = await createGa4EventTag({
      accountId,
      containerId,
      workspaceId,
      eventName,
      tagName,
      measurementId,
      parameters,
      firingTriggerIds: ["(triggerId after creation)"],
      dryRun: true,
      confirm: true,
    });
    return {
      dryRun: true,
      trigger: triggerResult,
      tag: tagPreview,
    };
  }

  const triggerId =
    (triggerResult as any).trigger?.triggerId ||
    (triggerResult as any).existing?.triggerId;

  if (!triggerId) {
    throw new Error("Failed to resolve triggerId after trigger creation");
  }

  // 2. Tag linked to trigger
  const tagResult = await createGa4EventTag({
    accountId,
    containerId,
    workspaceId,
    eventName,
    tagName,
    measurementId,
    parameters,
    firingTriggerIds: [triggerId],
    dryRun: false,
    confirm: true,
  });

  return {
    created: true,
    eventName,
    trigger: triggerResult,
    tag: tagResult,
    nextSteps: [
      "Ouvrir GTM → Preview pour tester le dataLayer.push",
      `dataLayer.push({ event: '${eventName}'${parameters?.length ? ", ...params" : ""} })`,
      "Vérifier dans GA4 DebugView",
      "Publier le workspace depuis l'UI GTM quand validé",
    ],
  };
}
