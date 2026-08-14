import { getGa4Tags, listGtmTags } from "./tagmanager-api.js";
import { listGtmClients, listSgtmContainers, auditSgtmSetup } from "./sgtm-api.js";
import { runReport } from "./data-api.js";

/**
 * S3 — Compare dual-tagging setup: web GTM events vs sGTM capability vs events actually received in GA4.
 */
export async function compareDualTagging(params: {
  // Web container
  webAccountId: string;
  webContainerId: string;
  webWorkspaceId?: string;
  // Server container
  serverAccountId: string;
  serverContainerId: string;
  serverWorkspaceId?: string;
  // GA4
  propertyId: string;
  startDate?: string;
  endDate?: string;
}) {
  const {
    webAccountId,
    webContainerId,
    webWorkspaceId,
    serverAccountId,
    serverContainerId,
    serverWorkspaceId,
    propertyId,
    startDate = "30daysAgo",
    endDate = "yesterday",
  } = params;

  // ─── Web GTM event tags ─────────────────────────────────────
  let webEvents: string[] = [];
  let webConfigTags = 0;
  let webError: string | null = null;

  try {
    let ws = webWorkspaceId;
    if (!ws) {
      const { listGtmWorkspaces } = await import("./tagmanager-api.js");
      const w = await listGtmWorkspaces(webAccountId, webContainerId);
      ws =
        w.workspaces.find((x: any) => x.name === "Default Workspace")
          ?.workspaceId || w.workspaces[0]?.workspaceId;
    }
    if (!ws) throw new Error("No web workspace");

    const ga4 = await getGa4Tags(webAccountId, webContainerId, ws);
    webConfigTags = ga4.tags.filter((t: any) => t.isConfigTag).length;
    webEvents = [
      ...new Set(
        ga4.tags
          .filter((t: any) => t.isEventTag && t.eventName)
          .map((t: any) => t.eventName as string)
      ),
    ].sort();
  } catch (err: any) {
    webError = err.message;
  }

  // ─── Server GTM ─────────────────────────────────────────────
  let serverAudit: any = null;
  let serverClients: any[] = [];
  let serverGa4Tags = 0;
  let serverError: string | null = null;

  try {
    serverAudit = await auditSgtmSetup({
      accountId: serverAccountId,
      containerId: serverContainerId,
      workspaceId: serverWorkspaceId,
    });
    serverClients = serverAudit.clients || [];
    serverGa4Tags = serverAudit.summary?.ga4TagsCount || 0;
  } catch (err: any) {
    serverError = err.message;
  }

  // ─── GA4 received events ────────────────────────────────────
  let ga4Events: string[] = [];
  let ga4Counts: Record<string, number> = {};
  let ga4Error: string | null = null;

  try {
    const report = await runReport({
      propertyId,
      metrics: ["eventCount"],
      dimensions: ["eventName"],
      startDate,
      endDate,
      limit: 200,
    });
    for (const row of report.rows || []) {
      ga4Events.push(row.eventName);
      ga4Counts[row.eventName] = parseInt(row.eventCount || "0", 10);
    }
    ga4Events = [...new Set(ga4Events)].sort();
  } catch (err: any) {
    ga4Error = err.message;
  }

  // ─── Comparison ─────────────────────────────────────────────
  const inWebNotGa4 = webEvents.filter((e) => !ga4Events.includes(e));
  const inGa4NotWeb = ga4Events.filter((e) => !webEvents.includes(e));
  const matchedWebGa4 = webEvents.filter((e) => ga4Events.includes(e));

  const enhancedMeasurement = [
    "scroll",
    "outbound_click",
    "site_search",
    "video_start",
    "video_progress",
    "video_complete",
    "file_download",
    "page_view",
    "first_visit",
    "session_start",
    "user_engagement",
  ];

  const probablyEnhanced = inGa4NotWeb.filter((e) =>
    enhancedMeasurement.includes(e)
  );

  const hasGa4Client = serverClients.some(
    (c: any) => c.category === "ga4_web" || c.category === "ga4_app"
  );
  const hasMpClient = serverClients.some(
    (c: any) => c.category === "measurement_protocol"
  );

  // Dual-tagging readiness signals
  const signals = {
    webHasConfigTag: webConfigTags > 0,
    webHasEventTags: webEvents.length > 0,
    serverHasGa4Client: hasGa4Client,
    serverHasGa4Tag: serverGa4Tags > 0,
    serverHasMpClient: hasMpClient,
    ga4ReceivingEvents: ga4Events.length > 0,
    webGa4MatchRate:
      webEvents.length > 0
        ? Math.round((matchedWebGa4.length / webEvents.length) * 100)
        : null,
  };

  const risks: string[] = [];
  if (!signals.serverHasGa4Client) {
    risks.push("sGTM sans client GA4 — les hits web ne seront pas parsés côté serveur");
  }
  if (!signals.serverHasGa4Tag) {
    risks.push("sGTM sans tag GA4 — les events ne seront pas renvoyés vers la property");
  }
  if (inWebNotGa4.length > 0) {
    risks.push(
      `${inWebNotGa4.length} event(s) web configurés absents de GA4 — corriger avant cutover`
    );
  }
  if (!signals.webHasConfigTag) {
    risks.push("Pas de tag GA4 Configuration côté web — server_container_url impossible à valider via tags seuls");
  }

  return {
    meta: {
      propertyId,
      period: { startDate, endDate },
      web: { accountId: webAccountId, containerId: webContainerId },
      server: { accountId: serverAccountId, containerId: serverContainerId },
      comparedAt: new Date().toISOString(),
    },
    errors: { webError, serverError, ga4Error },
    web: {
      configTags: webConfigTags,
      eventNames: webEvents,
      eventCount: webEvents.length,
    },
    server: {
      score: serverAudit?.score ?? null,
      grade: serverAudit?.grade ?? null,
      clients: serverClients.map((c: any) => ({
        name: c.name,
        type: c.type,
        category: c.category,
      })),
      ga4TagsCount: serverGa4Tags,
      hasGa4Client,
      hasMpClient,
    },
    ga4: {
      receivedEventNames: ga4Events,
      counts: ga4Counts,
      receivedCount: ga4Events.length,
    },
    comparison: {
      matchedWebGa4,
      configuredInWebButNotInGa4: inWebNotGa4,
      inGa4ButNotInWebGtm: inGa4NotWeb,
      probablyEnhancedMeasurement: probablyEnhanced,
    },
    dualTaggingSignals: signals,
    risks,
    recommendation:
      risks.length === 0
        ? "Base saine pour une phase de dual-tagging / validation de parité"
        : "Corriger les risques listés avant d'augmenter le trafic serveur ou de couper le client-side",
  };
}
