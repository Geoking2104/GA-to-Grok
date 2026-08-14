import { google } from "googleapis";
import { getAuthClient } from "../auth/service-account.js";
import { listGtmAccounts, listGtmContainers, listGtmWorkspaces, listGtmTags } from "./tagmanager-api.js";
import { cacheGet, cacheSet, cacheKey, TTL } from "../cache/redis.js";

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

function isServerContainer(usageContext: any): boolean {
  if (!usageContext) return false;
  const ctx = Array.isArray(usageContext) ? usageContext : [usageContext];
  return ctx.some((c: string) => String(c).toUpperCase() === "SERVER");
}

/**
 * List all server-side GTM containers accessible with current credentials.
 */
export async function listSgtmContainers() {
  const key = cacheKey("sgtm-containers", {});
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const accounts = await listGtmAccounts();
  const serverContainers: any[] = [];

  for (const account of accounts.accounts || []) {
    try {
      const containers = await listGtmContainers(account.accountId);
      for (const c of containers.containers || []) {
        if (isServerContainer(c.usageContext)) {
          serverContainers.push({
            accountId: account.accountId,
            accountName: account.name,
            containerId: c.containerId,
            name: c.name,
            publicId: c.publicId,
            usageContext: c.usageContext,
            path: c.path,
          });
        }
      }
    } catch {
      // skip accounts without permission
    }
  }

  const result = {
    count: serverContainers.length,
    containers: serverContainers,
  };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/**
 * List clients in a GTM workspace (primarily relevant for SERVER containers).
 */
export async function listGtmClients(
  accountId: string,
  containerId: string,
  workspaceId: string
) {
  const key = cacheKey("gtm-clients", { accountId, containerId, workspaceId });
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const client = await getClient();
  const parent = workspacePath(accountId, containerId, workspaceId);

  const res = await client.accounts.containers.workspaces.clients.list({ parent });

  const clients = (res.data.client || []).map((c: any) => ({
    clientId: c.clientId,
    name: c.name,
    type: c.type,
    parameter: c.parameter || [],
    priority: c.priority,
    path: c.path,
  }));

  const result = {
    accountId,
    containerId,
    workspaceId,
    count: clients.length,
    clients,
  };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/**
 * Get full details of a specific client.
 */
export async function getGtmClientDetails(
  accountId: string,
  containerId: string,
  workspaceId: string,
  clientId: string
) {
  const client = await getClient();
  const path = `${workspacePath(accountId, containerId, workspaceId)}/clients/${clientId}`;
  const res = await client.accounts.containers.workspaces.clients.get({ path });
  const c = res.data;

  return {
    clientId: c.clientId,
    name: c.name,
    type: c.type,
    parameter: c.parameter || [],
    priority: c.priority,
    path: c.path,
    notes: c.notes,
  };
}

/** Known sGTM client types */
const GA4_WEB_CLIENT_TYPES = ["gaaw_client", "ga4_client", "googtag_client"];
const MP_CLIENT_TYPES = ["mp", "measurement_protocol", "mp_client"];
const GA4_APP_CLIENT_TYPES = ["gaaw_app_client", "ga4_app_client"];

function classifyClient(type: string): string {
  const t = (type || "").toLowerCase();
  if (GA4_WEB_CLIENT_TYPES.some((x) => t.includes(x.replace("_client", "")) || t === x)) {
    return "ga4_web";
  }
  // Google API often uses type codes like "gaaw_client"
  if (t.includes("gaaw") && !t.includes("app")) return "ga4_web";
  if (t.includes("app")) return "ga4_app";
  if (t.includes("mp") || t.includes("measurement")) return "measurement_protocol";
  if (t.includes("ua") || t.includes("universal")) return "universal_analytics_legacy";
  return "other";
}

function isGa4ServerTag(type: string): boolean {
  const t = (type || "").toLowerCase();
  // Server-side GA4 tag types commonly: "sgtmgaaw", "gaaw", "googtag"
  return (
    t.includes("gaaw") ||
    t.includes("sgtmgaaw") ||
    t === "googtag" ||
    t.includes("ga4")
  );
}

/**
 * Resolve default workspace if not provided.
 */
async function resolveWorkspace(
  accountId: string,
  containerId: string,
  workspaceId?: string
): Promise<string> {
  if (workspaceId) return workspaceId;
  const workspaces = await listGtmWorkspaces(accountId, containerId);
  const defaultWs =
    workspaces.workspaces.find((w: any) => w.name === "Default Workspace") ||
    workspaces.workspaces[0];
  if (!defaultWs) throw new Error("No workspace found in this container");
  return defaultWs.workspaceId;
}

/**
 * Full audit of a server-side GTM container setup for GA4.
 */
export async function auditSgtmSetup(params: {
  accountId: string;
  containerId: string;
  workspaceId?: string;
}) {
  const { accountId, containerId } = params;
  const workspaceId = await resolveWorkspace(
    accountId,
    containerId,
    params.workspaceId
  );

  // Verify it's a server container when possible
  let usageContext: any = null;
  try {
    const containers = await listGtmContainers(accountId);
    const match = (containers.containers || []).find(
      (c: any) => c.containerId === containerId
    );
    usageContext = match?.usageContext;
  } catch {
    // ignore
  }

  const isServer = isServerContainer(usageContext);

  // Clients
  let clientsResult: any = { clients: [], count: 0 };
  try {
    clientsResult = await listGtmClients(accountId, containerId, workspaceId);
  } catch (err: any) {
    return {
      error: `Failed to list clients (is this a SERVER container? Clients API is mainly for sGTM): ${err.message}`,
      accountId,
      containerId,
      workspaceId,
      usageContext,
      isServerContainer: isServer,
    };
  }

  const classifiedClients = (clientsResult.clients || []).map((c: any) => ({
    ...c,
    category: classifyClient(c.type),
  }));

  const hasGa4WebClient = classifiedClients.some((c: any) => c.category === "ga4_web");
  const hasMpClient = classifiedClients.some(
    (c: any) => c.category === "measurement_protocol"
  );
  const hasGa4AppClient = classifiedClients.some((c: any) => c.category === "ga4_app");
  const hasLegacyUaClient = classifiedClients.some(
    (c: any) => c.category === "universal_analytics_legacy"
  );

  // Tags
  let tags: any[] = [];
  try {
    const tagsResult = await listGtmTags(accountId, containerId, workspaceId);
    tags = tagsResult.tags || [];
  } catch {
    // ignore
  }

  const ga4Tags = tags.filter((t) => isGa4ServerTag(t.type));
  const hasGa4Tag = ga4Tags.length > 0;

  // Issues & score
  const issues: Array<{ severity: string; code: string; message: string; recommendation?: string }> = [];
  let score = 100;

  if (!isServer && usageContext) {
    issues.push({
      severity: "high",
      code: "NOT_SERVER_CONTEXT",
      message: `usageContext does not indicate SERVER (${JSON.stringify(usageContext)})`,
      recommendation: "This audit is intended for server-side containers",
    });
    score -= 15;
  }

  if (clientsResult.count === 0) {
    issues.push({
      severity: "critical",
      code: "NO_CLIENTS",
      message: "Aucun client trouvé dans le workspace",
      recommendation: "Ajouter au minimum un client Google Analytics: GA4",
    });
    score -= 40;
  }

  if (!hasGa4WebClient && !hasGa4AppClient && !hasMpClient) {
    issues.push({
      severity: "critical",
      code: "NO_GA4_OR_MP_CLIENT",
      message: "Aucun client GA4 (web/app) ni Measurement Protocol détecté",
      recommendation: "Configurer le client GA4 pour recevoir les hits /g/collect",
    });
    score -= 30;
  } else if (!hasGa4WebClient) {
    issues.push({
      severity: "medium",
      code: "NO_GA4_WEB_CLIENT",
      message: "Pas de client GA4 web — OK si uniquement app/MP",
      recommendation: "Pour le tracking web, ajouter le client Google Analytics: GA4",
    });
    score -= 10;
  }

  if (!hasGa4Tag) {
    issues.push({
      severity: "critical",
      code: "NO_GA4_SERVER_TAG",
      message: "Aucun tag GA4 détecté côté serveur",
      recommendation: "Créer un tag Google Analytics: GA4 dans le container serveur",
    });
    score -= 25;
  }

  if (hasLegacyUaClient) {
    issues.push({
      severity: "low",
      code: "LEGACY_UA_CLIENT",
      message: "Client Universal Analytics (legacy) encore présent",
      recommendation: "Retirer UA si plus utilisé",
    });
    score -= 5;
  }

  if (!hasMpClient) {
    issues.push({
      severity: "info",
      code: "NO_MP_CLIENT",
      message: "Pas de client Measurement Protocol",
      recommendation:
        "Optionnel mais recommandé pour les events backend (purchase confirmé, CRM)",
    });
  }

  score = Math.max(0, Math.min(100, score));

  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";

  const recommendations = [
    ...new Set(
      issues.filter((i) => i.recommendation).map((i) => i.recommendation as string)
    ),
  ];

  return {
    meta: {
      accountId,
      containerId,
      workspaceId,
      usageContext,
      isServerContainer: isServer,
      auditedAt: new Date().toISOString(),
    },
    score,
    grade,
    summary: {
      clientsCount: clientsResult.count,
      hasGa4WebClient,
      hasGa4AppClient,
      hasMpClient,
      hasGa4ServerTag: hasGa4Tag,
      ga4TagsCount: ga4Tags.length,
      tagsCount: tags.length,
    },
    clients: classifiedClients,
    ga4Tags: ga4Tags.map((t) => ({
      tagId: t.tagId,
      name: t.name,
      type: t.type,
      firingTriggerId: t.firingTriggerId,
    })),
    issues: issues.sort((a, b) => {
      const order = ["critical", "high", "medium", "low", "info"];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    }),
    recommendations,
  };
}
