import { google } from "googleapis";
import { getAuthClient } from "../auth/service-account.js";
import { cacheGet, cacheSet, cacheKey, TTL } from "../cache/redis.js";

let tagmanagerClient: ReturnType<typeof google.tagmanager> | null = null;

async function getTagManagerClient() {
  if (tagmanagerClient) return tagmanagerClient;

  const auth = await getAuthClient();
  tagmanagerClient = google.tagmanager({
    version: "v2",
    auth: auth as any,
  });
  return tagmanagerClient;
}

function workspacePath(accountId: string, containerId: string, workspaceId: string) {
  return `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
}

/** List all GTM accounts accessible with current credentials */
export async function listGtmAccounts() {
  const key = cacheKey("gtm-accounts", {});
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const client = await getTagManagerClient();
  const res = await client.accounts.list({});
  const accounts = (res.data.account || []).map((a: any) => ({
    accountId: a.accountId,
    name: a.name,
    path: a.path,
  }));

  const result = { count: accounts.length, accounts };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/** List containers of a GTM account */
export async function listGtmContainers(accountId: string) {
  const key = cacheKey("gtm-containers", { accountId });
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const client = await getTagManagerClient();
  const parent = `accounts/${accountId}`;
  const res = await client.accounts.containers.list({ parent });
  const containers = (res.data.container || []).map((c: any) => ({
    containerId: c.containerId,
    name: c.name,
    publicId: c.publicId,
    usageContext: c.usageContext,
    path: c.path,
  }));

  const result = { accountId, count: containers.length, containers };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/** List workspaces of a container */
export async function listGtmWorkspaces(accountId: string, containerId: string) {
  const client = await getTagManagerClient();
  const parent = `accounts/${accountId}/containers/${containerId}`;
  const res = await client.accounts.containers.workspaces.list({ parent });

  const workspaces = (res.data.workspace || []).map((w: any) => ({
    workspaceId: w.workspaceId,
    name: w.name,
    description: w.description,
    path: w.path,
  }));

  return { accountId, containerId, count: workspaces.length, workspaces };
}

/** List all tags in a workspace */
export async function listGtmTags(
  accountId: string,
  containerId: string,
  workspaceId: string
) {
  const client = await getTagManagerClient();
  const parent = workspacePath(accountId, containerId, workspaceId);
  const res = await client.accounts.containers.workspaces.tags.list({ parent });

  const tags = (res.data.tag || []).map((t: any) => ({
    tagId: t.tagId,
    name: t.name,
    type: t.type,
    firingTriggerId: t.firingTriggerId || [],
    blockingTriggerId: t.blockingTriggerId || [],
    parameter: t.parameter || [],
    path: t.path,
  }));

  return { accountId, containerId, workspaceId, count: tags.length, tags };
}

// ─── Phase 2 : Triggers ───────────────────────────────────────────────────

/** GTM-09 — List all triggers in a workspace */
export async function listGtmTriggers(
  accountId: string,
  containerId: string,
  workspaceId: string
) {
  const key = cacheKey("gtm-triggers", { accountId, containerId, workspaceId });
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const client = await getTagManagerClient();
  const parent = workspacePath(accountId, containerId, workspaceId);
  const res = await client.accounts.containers.workspaces.triggers.list({ parent });

  const triggers = (res.data.trigger || []).map((t: any) => ({
    triggerId: t.triggerId,
    name: t.name,
    type: t.type,
    filter: t.filter || [],
    customEventFilter: t.customEventFilter || [],
    path: t.path,
  }));

  const result = { accountId, containerId, workspaceId, count: triggers.length, triggers };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/** GTM-10 — Get full details of a specific trigger */
export async function getTriggerDetails(
  accountId: string,
  containerId: string,
  workspaceId: string,
  triggerId: string
) {
  const client = await getTagManagerClient();
  const path = `${workspacePath(accountId, containerId, workspaceId)}/triggers/${triggerId}`;
  const res = await client.accounts.containers.workspaces.triggers.get({ path });
  const t = res.data;

  return {
    triggerId: t.triggerId,
    name: t.name,
    type: t.type,
    filter: t.filter || [],
    customEventFilter: t.customEventFilter || [],
    waitForTags: t.waitForTags,
    checkValidation: t.checkValidation,
    uniqueTriggerId: t.uniqueTriggerId,
    eventName: t.eventName,
    interval: t.interval,
    limit: t.limit,
    path: t.path,
    notes: t.notes,
  };
}

// ─── Phase 2 : Variables ──────────────────────────────────────────────────

/** GTM-11 — List all user-defined variables in a workspace */
export async function listGtmVariables(
  accountId: string,
  containerId: string,
  workspaceId: string
) {
  const key = cacheKey("gtm-variables", { accountId, containerId, workspaceId });
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const client = await getTagManagerClient();
  const parent = workspacePath(accountId, containerId, workspaceId);
  const res = await client.accounts.containers.workspaces.variables.list({ parent });

  const variables = (res.data.variable || []).map((v: any) => ({
    variableId: v.variableId,
    name: v.name,
    type: v.type,
    parameter: v.parameter || [],
    path: v.path,
  }));

  const result = { accountId, containerId, workspaceId, count: variables.length, variables };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/** GTM-12 — Get full details of a specific variable */
export async function getVariableDetails(
  accountId: string,
  containerId: string,
  workspaceId: string,
  variableId: string
) {
  const client = await getTagManagerClient();
  const path = `${workspacePath(accountId, containerId, workspaceId)}/variables/${variableId}`;
  const res = await client.accounts.containers.workspaces.variables.get({ path });
  const v = res.data;

  return {
    variableId: v.variableId,
    name: v.name,
    type: v.type,
    parameter: v.parameter || [],
    formatValue: v.formatValue,
    path: v.path,
    notes: v.notes,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Extract Measurement IDs from tag parameters */
function extractMeasurementIds(parameters: any[] = []): string[] {
  const ids: string[] = [];
  for (const p of parameters) {
    if (
      (p.key === "measurementId" || p.key === "trackingId" || p.key === "tagId") &&
      typeof p.value === "string" &&
      p.value.startsWith("G-")
    ) {
      ids.push(p.value);
    }
    if (p.list) {
      for (const item of p.list) {
        if (item.map) {
          for (const m of item.map) {
            if (
              (m.key === "measurementId" || m.key === "value") &&
              typeof m.value === "string" &&
              m.value.startsWith("G-")
            ) {
              ids.push(m.value);
            }
          }
        }
      }
    }
  }
  return [...new Set(ids)];
}

function extractEventName(parameters: any[] = []): string | null {
  const p = parameters.find((x: any) => x.key === "eventName");
  return p?.value || null;
}

function simplifyParameters(parameters: any[] = []) {
  return parameters.map((p: any) => ({
    key: p.key,
    type: p.type,
    value: p.value ?? null,
    // Keep nested structures readable
    list: p.list || undefined,
    map: p.map || undefined,
  }));
}

/** Get only GA4-related tags (googtag + gaawe + gaawc) */
export async function getGa4Tags(
  accountId: string,
  containerId: string,
  workspaceId: string
) {
  const all = await listGtmTags(accountId, containerId, workspaceId);
  const ga4Types = ["googtag", "gaawe", "gaawc"];

  const ga4Tags = all.tags
    .filter((t: any) => ga4Types.includes(t.type))
    .map((t: any) => ({
      ...t,
      measurementIds: extractMeasurementIds(t.parameter),
      eventName: extractEventName(t.parameter),
      isConfigTag: t.type === "googtag" || t.type === "gaawc",
      isEventTag: t.type === "gaawe",
    }));

  return {
    accountId,
    containerId,
    workspaceId,
    count: ga4Tags.length,
    tags: ga4Tags,
  };
}

/** GTM-13 — Get enriched details of a specific tag (with resolved trigger names) */
export async function getTagDetails(
  accountId: string,
  containerId: string,
  workspaceId: string,
  tagId: string
) {
  const client = await getTagManagerClient();
  const path = `${workspacePath(accountId, containerId, workspaceId)}/tags/${tagId}`;
  const res = await client.accounts.containers.workspaces.tags.get({ path });
  const t = res.data;

  // Resolve trigger names
  const triggersList = await listGtmTriggers(accountId, containerId, workspaceId);
  const triggerMap = new Map(
    triggersList.triggers.map((tr: any) => [tr.triggerId, tr.name])
  );

  const firingTriggers = (t.firingTriggerId || []).map((id: string) => ({
    triggerId: id,
    name: triggerMap.get(id) || "(unknown)",
  }));

  const blockingTriggers = (t.blockingTriggerId || []).map((id: string) => ({
    triggerId: id,
    name: triggerMap.get(id) || "(unknown)",
  }));

  return {
    tagId: t.tagId,
    name: t.name,
    type: t.type,
    measurementIds: extractMeasurementIds(t.parameter || []),
    eventName: extractEventName(t.parameter || []),
    parameters: simplifyParameters(t.parameter || []),
    firingTriggers,
    blockingTriggers,
    priority: t.priority,
    notes: t.notes,
    path: t.path,
    isConfigTag: t.type === "googtag" || t.type === "gaawc",
    isEventTag: t.type === "gaawe",
  };
}

/** High-level container summary focused on GA4 */
export async function getGtmContainerSummary(
  accountId: string,
  containerId: string,
  workspaceId?: string
) {
  let wsId = workspaceId;
  if (!wsId) {
    const workspaces = await listGtmWorkspaces(accountId, containerId);
    const defaultWs =
      workspaces.workspaces.find((w: any) => w.name === "Default Workspace") ||
      workspaces.workspaces[0];
    if (!defaultWs) {
      throw new Error("No workspace found in this container");
    }
    wsId = defaultWs.workspaceId;
  }

  const ga4 = await getGa4Tags(accountId, containerId, wsId);

  const measurementIds = [
    ...new Set(ga4.tags.flatMap((t: any) => t.measurementIds)),
  ];

  const configTags = ga4.tags.filter((t: any) => t.isConfigTag);
  const eventTags = ga4.tags.filter((t: any) => t.isEventTag);

  return {
    accountId,
    containerId,
    workspaceId: wsId,
    measurementIds,
    hasGa4ConfigTag: configTags.length > 0,
    ga4ConfigTagsCount: configTags.length,
    ga4EventTagsCount: eventTags.length,
    ga4ConfigTags: configTags,
    ga4EventTags: eventTags,
  };
}

/** Recommended events list (Google best practices) */
const RECOMMENDED_EVENTS = [
  "page_view",
  "purchase",
  "add_to_cart",
  "begin_checkout",
  "generate_lead",
  "sign_up",
  "login",
  "search",
  "view_item",
  "add_payment_info",
  "add_shipping_info",
  "view_item_list",
  "select_item",
  "view_cart",
];

/** Intelligent audit of GA4 setup inside a GTM container */
export async function auditGa4Setup(
  accountId: string,
  containerId: string,
  workspaceId?: string
) {
  const summary = await getGtmContainerSummary(accountId, containerId, workspaceId);

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (!summary.hasGa4ConfigTag) {
    warnings.push("Aucun tag GA4 Configuration (googtag) trouvé");
    recommendations.push("Ajouter un tag Google Tag (GA4 Configuration) avec le bon Measurement ID");
    score -= 40;
  } else if (summary.ga4ConfigTagsCount > 1) {
    warnings.push(`Plusieurs tags GA4 Configuration détectés (${summary.ga4ConfigTagsCount})`);
    recommendations.push("Vérifier s'il y a des doublons de tags de configuration");
    score -= 10;
  }

  if (summary.measurementIds.length === 0) {
    warnings.push("Aucun Measurement ID (G-XXXXXXXX) détecté dans les tags");
    score -= 20;
  }

  const eventNames: string[] = [];
  for (const tag of summary.ga4EventTags) {
    if (tag.eventName) eventNames.push(tag.eventName);
  }

  const missingRecommended = RECOMMENDED_EVENTS.filter(
    (e) => !eventNames.includes(e)
  );

  if (summary.ga4EventTagsCount === 0) {
    warnings.push("Aucun tag GA4 Event trouvé");
    recommendations.push("Créer des tags GA4 Event pour les interactions importantes");
    score -= 15;
  }

  if (missingRecommended.length > 5) {
    score -= 10;
  }

  for (const tag of summary.ga4ConfigTags) {
    if (!tag.firingTriggerId || tag.firingTriggerId.length === 0) {
      warnings.push(`Le tag de configuration "${tag.name}" n'a aucun trigger de déclenchement`);
      score -= 15;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    ...summary,
    eventNamesFound: eventNames,
    missingRecommendedEvents: missingRecommended,
    warnings,
    recommendations,
    score,
  };
}
