import { auditSgtmSetup } from "./sgtm-api.js";
import { auditGa4SetupV2 } from "./gtm-audit-v2.js";
import { verifyGa4Secrets } from "./mp-secrets.js";
import { analyzeEcommerceData } from "./ecommerce-data.js";
import { compareDualTagging } from "./sgtm-dual-tagging.js";

export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  status: "pass" | "fail" | "warn" | "skip";
  detail?: string;
  required: boolean;
}

/**
 * S4 — Automated cutover checklist for migrating collection to sGTM.
 */
export async function cutoverChecklist(params: {
  // Web GTM
  webAccountId: string;
  webContainerId: string;
  webWorkspaceId?: string;
  // Server GTM
  serverAccountId: string;
  serverContainerId: string;
  serverWorkspaceId?: string;
  // GA4
  propertyId: string;
  // Optional health URL
  sgtmHealthUrl?: string;
  startDate?: string;
  endDate?: string;
}) {
  const items: ChecklistItem[] = [];
  const {
    webAccountId,
    webContainerId,
    webWorkspaceId,
    serverAccountId,
    serverContainerId,
    serverWorkspaceId,
    propertyId,
    sgtmHealthUrl,
    startDate = "30daysAgo",
    endDate = "yesterday",
  } = params;

  // 1. Web audit
  try {
    const webAudit = await auditGa4SetupV2({
      accountId: webAccountId,
      containerId: webContainerId,
      workspaceId: webWorkspaceId,
      propertyId,
      startDate,
      endDate,
    });
    items.push({
      id: "web_audit_score",
      category: "web",
      title: "Audit GTM Web score ≥ 70",
      status: webAudit.score >= 70 ? "pass" : webAudit.score >= 50 ? "warn" : "fail",
      detail: `score=${webAudit.score}, grade=${webAudit.grade}`,
      required: true,
    });
    items.push({
      id: "web_config_tag",
      category: "web",
      title: "Tag GA4 Configuration présent (web)",
      status: webAudit.summary?.hasGa4ConfigTag ? "pass" : "fail",
      required: true,
    });
  } catch (err: any) {
    items.push({
      id: "web_audit_score",
      category: "web",
      title: "Audit GTM Web exécutable",
      status: "fail",
      detail: err.message,
      required: true,
    });
  }

  // 2. Server audit
  try {
    const sAudit = await auditSgtmSetup({
      accountId: serverAccountId,
      containerId: serverContainerId,
      workspaceId: serverWorkspaceId,
    });
    items.push({
      id: "sgtm_score",
      category: "server",
      title: "Audit sGTM score ≥ 70",
      status: sAudit.score >= 70 ? "pass" : sAudit.score >= 50 ? "warn" : "fail",
      detail: `score=${sAudit.score}, grade=${sAudit.grade}`,
      required: true,
    });
    items.push({
      id: "sgtm_ga4_client",
      category: "server",
      title: "Client GA4 présent côté serveur",
      status: sAudit.summary?.hasGa4WebClient || sAudit.summary?.hasGa4AppClient ? "pass" : "fail",
      required: true,
    });
    items.push({
      id: "sgtm_ga4_tag",
      category: "server",
      title: "Tag GA4 serveur présent",
      status: sAudit.summary?.hasGa4ServerTag ? "pass" : "fail",
      required: true,
    });
    items.push({
      id: "sgtm_mp_client",
      category: "server",
      title: "Client Measurement Protocol (recommandé)",
      status: sAudit.summary?.hasMpClient ? "pass" : "warn",
      detail: sAudit.summary?.hasMpClient ? "présent" : "absent — optionnel pour backend events",
      required: false,
    });
  } catch (err: any) {
    items.push({
      id: "sgtm_score",
      category: "server",
      title: "Audit sGTM exécutable",
      status: "fail",
      detail: err.message,
      required: true,
    });
  }

  // 3. Secrets MP
  try {
    const secrets = await verifyGa4Secrets({ propertyId, revealSecrets: false });
    items.push({
      id: "mp_secrets",
      category: "ga4",
      title: "Au moins un stream prêt pour Measurement Protocol",
      status: secrets.summary.streamsReadyForMp > 0 ? "pass" : "warn",
      detail: `${secrets.summary.streamsReadyForMp}/${secrets.summary.streamsCount} streams ready`,
      required: false,
    });
  } catch (err: any) {
    items.push({
      id: "mp_secrets",
      category: "ga4",
      title: "Vérification des secrets MP",
      status: "warn",
      detail: err.message,
      required: false,
    });
  }

  // 4. Dual tagging comparison
  try {
    const dual = await compareDualTagging({
      webAccountId,
      webContainerId,
      webWorkspaceId,
      serverAccountId,
      serverContainerId,
      serverWorkspaceId,
      propertyId,
      startDate,
      endDate,
    });
    const matchRate = dual.dualTaggingSignals.webGa4MatchRate;
    items.push({
      id: "parity_match_rate",
      category: "parity",
      title: "Match rate web events ↔ GA4 ≥ 70%",
      status:
        matchRate === null ? "warn" : matchRate >= 70 ? "pass" : matchRate >= 40 ? "warn" : "fail",
      detail: matchRate === null ? "n/a" : `${matchRate}%`,
      required: true,
    });
    items.push({
      id: "parity_missing_events",
      category: "parity",
      title: "Peu d'events web absents de GA4 (≤ 3)",
      status:
        dual.comparison.configuredInWebButNotInGa4.length <= 3 ? "pass" : "warn",
      detail: dual.comparison.configuredInWebButNotInGa4.slice(0, 10).join(", ") || "none",
      required: false,
    });
  } catch (err: any) {
    items.push({
      id: "parity_match_rate",
      category: "parity",
      title: "Comparaison dual-tagging exécutable",
      status: "fail",
      detail: err.message,
      required: true,
    });
  }

  // 5. Ecommerce data quality (if any purchases)
  try {
    const ecom = await analyzeEcommerceData({
      propertyId,
      startDate,
      endDate,
    });
    items.push({
      id: "ecom_data_quality",
      category: "data",
      title: "Qualité données e-commerce (pas d'issues critiques)",
      status: ecom.dataQuality?.healthy ? "pass" : "warn",
      detail: (ecom.dataQuality?.issues || []).slice(0, 3).join(" | ") || "ok",
      required: false,
    });
  } catch {
    items.push({
      id: "ecom_data_quality",
      category: "data",
      title: "Analyse e-commerce",
      status: "skip",
      detail: "non disponible ou non e-commerce",
      required: false,
    });
  }

  // 6. Health endpoint
  if (sgtmHealthUrl) {
    try {
      const health = await checkSgtmHealthInternal(sgtmHealthUrl);
      items.push({
        id: "sgtm_health",
        category: "infra",
        title: "Endpoint sGTM /healthy OK",
        status: health.ok ? "pass" : "fail",
        detail: `status=${health.statusCode}, latencyMs=${health.latencyMs}`,
        required: true,
      });
    } catch (err: any) {
      items.push({
        id: "sgtm_health",
        category: "infra",
        title: "Endpoint sGTM /healthy OK",
        status: "fail",
        detail: err.message,
        required: true,
      });
    }
  } else {
    items.push({
      id: "sgtm_health",
      category: "infra",
      title: "Endpoint sGTM /healthy fourni",
      status: "skip",
      detail: "Passer sgtmHealthUrl pour activer ce check",
      required: false,
    });
  }

  // Score
  const required = items.filter((i) => i.required);
  const requiredPass = required.filter((i) => i.status === "pass").length;
  const requiredFail = required.filter((i) => i.status === "fail").length;
  const warnCount = items.filter((i) => i.status === "warn").length;

  const readyForCutover = requiredFail === 0 && requiredPass === required.length;
  const readyForDualTagging = requiredFail === 0;

  let score = 100;
  score -= requiredFail * 20;
  score -= warnCount * 5;
  score = Math.max(0, Math.min(100, score));

  return {
    meta: {
      propertyId,
      web: { accountId: webAccountId, containerId: webContainerId },
      server: { accountId: serverAccountId, containerId: serverContainerId },
      checkedAt: new Date().toISOString(),
    },
    score,
    readyForDualTagging,
    readyForCutover,
    summary: {
      total: items.length,
      pass: items.filter((i) => i.status === "pass").length,
      fail: items.filter((i) => i.status === "fail").length,
      warn: warnCount,
      skip: items.filter((i) => i.status === "skip").length,
      requiredPass,
      requiredFail,
    },
    items,
    nextSteps: readyForCutover
      ? [
          "Activer server_container_url sur le trafic progressif",
          "Monitorer 48–72h (analyze_ecommerce_data + realtime)",
          "Réconcilier purchases vs commandes CRM",
          "Réduire puis couper les hits client-side directs",
        ]
      : readyForDualTagging
        ? [
            "Corriger les items en fail/warn",
            "Lancer une phase dual-tagging avec event_id de dédup",
            "Rejouer cutover_checklist",
          ]
        : [
            "Corriger tous les checks required en fail",
            "Rejouer cutover_checklist avant toute bascule",
          ],
  };
}

async function checkSgtmHealthInternal(url: string) {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain, application/json, */*" },
    });
    const latencyMs = Date.now() - start;
    const text = await res.text().catch(() => "");
    return {
      ok: res.ok,
      statusCode: res.status,
      latencyMs,
      bodyPreview: text.slice(0, 200),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export { checkSgtmHealthInternal };
