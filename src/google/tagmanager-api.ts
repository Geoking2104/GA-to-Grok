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
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
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
    // Sometimes nested
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

/** High-level container summary focused on GA4 */
export async function getGtmContainerSummary(
  accountId: string,
  containerId: string,
  workspaceId?: string
) {
  // Resolve default workspace if not provided
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

  // 1. Config tag presence
  if (!summary.hasGa4ConfigTag) {
    warnings.push("Aucun tag GA4 Configuration (googtag) trouvé");
    recommendations.push("Ajouter un tag Google Tag (GA4 Configuration) avec le bon Measurement ID");
    score -= 40;
  } else if (summary.ga4ConfigTagsCount > 1) {
    warnings.push(`Plusieurs tags GA4 Configuration détectés (${summary.ga4ConfigTagsCount})`);
    recommendations.push("Vérifier s'il y a des doublons de tags de configuration");
    score -= 10;
  }

  // 2. Measurement IDs
  if (summary.measurementIds.length === 0) {
    warnings.push("Aucun Measurement ID (G-XXXXXXXX) détecté dans les tags");
    score -= 20;
  }

  // 3. Event tags analysis
  const eventNames: string[] = [];
  for (const tag of summary.ga4EventTags) {
    const eventNameParam = (tag.parameter || []).find(
      (p: any) => p.key === "eventName"
    );
    if (eventNameParam?.value) {
      eventNames.push(eventNameParam.value);
    }
  }

  const missingRecommended = RECOMMENDED_EVENTS.filter(
    (e) => !eventNames.includes(e)
  );

  if (summary.ga4EventTagsCount === 0) {
    warnings.push("Aucun tag GA4 Event trouvé");
    recommendations.push("Créer des tags GA4 Event pour les interactions importantes");
    score -= 15;
  }

  // Soft penalty for missing recommended events
  if (missingRecommended.length > 5) {
    score -= 10;
  }

  // 4. Basic firing trigger check (simplified)
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
