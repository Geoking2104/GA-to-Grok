import { listGtmClients, getGtmClientDetails } from "./sgtm-api.js";
import { listGtmTags, listGtmTriggers, listGtmWorkspaces } from "./tagmanager-api.js";

function isMpClientType(type: string): boolean {
  const t = (type || "").toLowerCase();
  return (
    t.includes("mp") ||
    t.includes("measurement_protocol") ||
    t.includes("measurement protocol") ||
    t === "mp_client"
  );
}

function isGa4TagType(type: string): boolean {
  const t = (type || "").toLowerCase();
  return t.includes("gaaw") || t.includes("sgtmgaaw") || t.includes("ga4") || t === "googtag";
}

function paramMap(parameters: any[] = []): Record<string, any> {
  const out: Record<string, any> = {};
  for (const p of parameters) {
    if (p.key) {
      out[p.key] = p.value ?? p.list ?? p.map ?? null;
    }
  }
  return out;
}

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
  if (!defaultWs) throw new Error("No workspace found");
  return defaultWs.workspaceId;
}

export interface MpAuditIssue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  code: string;
  message: string;
  recommendation?: string;
}

/**
 * Deep technical audit of Measurement Protocol client(s) in an sGTM workspace.
 */
export async function auditMeasurementProtocolClient(params: {
  accountId: string;
  containerId: string;
  workspaceId?: string;
  clientId?: string; // optional: focus on one client
}) {
  const { accountId, containerId, clientId } = params;
  const workspaceId = await resolveWorkspace(
    accountId,
    containerId,
    params.workspaceId
  );

  const issues: MpAuditIssue[] = [];
  let score = 100;

  // ─── 1. Discover MP clients ─────────────────────────────────
  const allClients = await listGtmClients(accountId, containerId, workspaceId);
  let mpClients = (allClients.clients || []).filter((c: any) =>
    isMpClientType(c.type)
  );

  if (clientId) {
    mpClients = mpClients.filter((c: any) => c.clientId === clientId);
    if (mpClients.length === 0) {
      // Maybe user passed id of a non-classified client — fetch details
      try {
        const detail = await getGtmClientDetails(
          accountId,
          containerId,
          workspaceId,
          clientId
        );
        if (isMpClientType(detail.type || "")) {
          mpClients = [detail];
        } else {
          return {
            error: `Client ${clientId} found but type "${detail.type}" does not look like Measurement Protocol`,
            client: detail,
          };
        }
      } catch (err: any) {
        return { error: `Client ${clientId} not found: ${err.message}` };
      }
    }
  }

  if (mpClients.length === 0) {
    return {
      meta: { accountId, containerId, workspaceId },
      score: 0,
      grade: "F",
      summary: {
        mpClientsCount: 0,
        hasMeasurementProtocolClient: false,
      },
      clients: [],
      issues: [
        {
          severity: "critical",
          code: "NO_MP_CLIENT",
          message: "Aucun client Measurement Protocol trouvé dans ce workspace",
          recommendation:
            "Créer un client de type Measurement Protocol (GA4) pour accepter les hits server-to-server",
        },
      ],
      recommendations: [
        "Ajouter un client Measurement Protocol dans le container serveur",
        "Définir un activation path dédié (ex: /mp/collect)",
        "Créer un tag GA4 serveur déclenché sur les events issus de ce client",
      ],
      technicalReference: getTechnicalReference(),
    };
  }

  if (mpClients.length > 1) {
    issues.push({
      severity: "medium",
      code: "MULTIPLE_MP_CLIENTS",
      message: `${mpClients.length} clients Measurement Protocol détectés — risque de routes qui se chevauchent`,
      recommendation:
        "Vérifier que les activation paths sont distincts et intentionnels",
    });
    score -= 8;
  }

  // ─── 2. Deep-dive each MP client ────────────────────────────
  const clientAudits = [];

  for (const base of mpClients) {
    let detail = base;
    try {
      detail = await getGtmClientDetails(
        accountId,
        containerId,
        workspaceId,
        base.clientId
      );
    } catch {
      // use list payload
    }

    const paramsObj = paramMap(detail.parameter || base.parameter || []);
    const clientIssues: MpAuditIssue[] = [];

    // Activation path
    const activationPath =
      paramsObj.activationPath ||
      paramsObj.path ||
      paramsObj.requestPath ||
      paramsObj.endpoint ||
      null;

    if (!activationPath) {
      clientIssues.push({
        severity: "high",
        code: "NO_ACTIVATION_PATH",
        message: `Client "${detail.name}" : activation path non détecté dans les paramètres`,
        recommendation:
          "Configurer un chemin d'activation explicite (ex: /mp/collect) pour éviter les collisions avec le client GA4 web",
      });
      score -= 15;
    } else {
      const pathStr = String(activationPath);
      if (pathStr.includes("/g/collect")) {
        clientIssues.push({
          severity: "critical",
          code: "PATH_COLLISION_GCOLLECT",
          message: `Activation path "${pathStr}" collisionne avec le endpoint GA4 web standard`,
          recommendation: "Utiliser un path distinct, typiquement /mp/collect",
        });
        score -= 25;
      }
      if (!pathStr.startsWith("/")) {
        clientIssues.push({
          severity: "medium",
          code: "PATH_NO_LEADING_SLASH",
          message: `Activation path "${pathStr}" sans slash initial`,
          recommendation: "Préfixer le path par /",
        });
        score -= 5;
      }
    }

    // Priority
    const priority = detail.priority ?? base.priority;
    if (priority === undefined || priority === null) {
      clientIssues.push({
        severity: "info",
        code: "NO_PRIORITY",
        message: `Client "${detail.name}" : priorité non définie`,
        recommendation:
          "Définir une priorité cohérente si plusieurs clients peuvent claim la même requête",
      });
    }

    // Common MP parameters worth noting
    const interestingKeys = Object.keys(paramsObj).filter((k) =>
      [
        "activationPath",
        "path",
        "requestPath",
        "endpoint",
        "acceptGtmBrowserRequests",
        "untrusted",
        "zone",
      ].some((x) => k.toLowerCase().includes(x.toLowerCase()))
    );

    clientAudits.push({
      clientId: detail.clientId || base.clientId,
      name: detail.name || base.name,
      type: detail.type || base.type,
      priority,
      activationPath,
      parameters: paramsObj,
      interestingParameterKeys: interestingKeys,
      issues: clientIssues,
    });

    issues.push(...clientIssues);
  }

  // ─── 3. Downstream: GA4 tags that can receive MP events ─────
  let tags: any[] = [];
  let triggers: any[] = [];
  try {
    const tagsResult = await listGtmTags(accountId, containerId, workspaceId);
    tags = tagsResult.tags || [];
  } catch {
    /* ignore */
  }
  try {
    const triggersResult = await listGtmTriggers(
      accountId,
      containerId,
      workspaceId
    );
    triggers = triggersResult.triggers || [];
  } catch {
    /* ignore */
  }

  const ga4Tags = tags.filter((t) => isGa4TagType(t.type));
  const tagsWithTriggers = ga4Tags.filter(
    (t) => t.firingTriggerId && t.firingTriggerId.length > 0
  );
  const tagsWithoutTriggers = ga4Tags.filter(
    (t) => !t.firingTriggerId || t.firingTriggerId.length === 0
  );

  if (ga4Tags.length === 0) {
    issues.push({
      severity: "critical",
      code: "NO_GA4_TAG_FOR_MP",
      message:
        "Client MP présent mais aucun tag GA4 serveur — les events MP ne seront pas envoyés à GA4",
      recommendation:
        "Créer un tag Google Analytics: GA4 déclenché sur All Events (ou events spécifiques)",
    });
    score -= 25;
  } else if (tagsWithoutTriggers.length === ga4Tags.length) {
    issues.push({
      severity: "high",
      code: "GA4_TAGS_NO_TRIGGERS",
      message: "Des tags GA4 existent mais aucun n'a de trigger de déclenchement",
      recommendation:
        "Lier les tags GA4 à un trigger (ex: All Events) pour traiter les events produits par le client MP",
    });
    score -= 15;
  }

  // ─── 4. Security / production notes ─────────────────────────
  issues.push({
    severity: "info",
    code: "SECURITY_REMINDER",
    message:
      "Les endpoints MP doivent être protégés (secret, IP allowlist, ou réseau privé) — le client GTM ne remplace pas l'auth applicative",
    recommendation:
      "Valider côté émetteur (api_secret GA4 ou secret custom) et ne pas exposer l'endpoint publiquement sans contrôle",
  });

  issues.push({
    severity: "info",
    code: "SCHEMA_REMINDER",
    message:
      "Le payload MP doit respecter le schema GA4 (client_id ou app_instance_id, events[], params)",
    recommendation:
      "Pour le web: client_id + measurement_id ; pour les apps: app_instance_id + firebase_app_id",
  });

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
      auditedAt: new Date().toISOString(),
    },
    score,
    grade,
    summary: {
      mpClientsCount: mpClients.length,
      hasMeasurementProtocolClient: true,
      ga4TagsCount: ga4Tags.length,
      ga4TagsWithTriggers: tagsWithTriggers.length,
      triggersCount: triggers.length,
    },
    clients: clientAudits,
    downstream: {
      ga4Tags: ga4Tags.map((t) => ({
        tagId: t.tagId,
        name: t.name,
        type: t.type,
        firingTriggerId: t.firingTriggerId || [],
        hasTrigger: !!(t.firingTriggerId && t.firingTriggerId.length),
      })),
    },
    issues: issues.sort((a, b) => {
      const order = ["critical", "high", "medium", "low", "info"];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    }),
    recommendations,
    technicalReference: getTechnicalReference(),
  };
}

function getTechnicalReference() {
  return {
    purpose:
      "Le client Measurement Protocol transforme des requêtes HTTP server-to-server en event model sGTM, ensuite traité par les tags (GA4, CAPI, etc.).",
    recommendedActivationPath: "/mp/collect",
    typicalPayloadWeb: {
      client_id: "xxxxxxxx.yyyyyyyy",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "T123",
            value: 49.99,
            currency: "EUR",
          },
        },
      ],
    },
    checklist: [
      "Client MP créé avec activation path dédié",
      "Path distinct de /g/collect",
      "Tag GA4 serveur présent et déclenché",
      "Events critiques (purchase) avec transaction_id / event_id pour dédup",
      "Endpoint non public sans auth ou secret",
      "Test via Preview sGTM + DebugView GA4",
    ],
    docs: [
      "https://developers.google.com/tag-platform/tag-manager/server-side/send-data",
      "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    ],
  };
}
