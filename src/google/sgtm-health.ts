import { checkSgtmHealthInternal } from "./sgtm-cutover.js";

/**
 * S5 — Health / observability checks for sGTM endpoint.
 */
export async function checkSgtmHealth(params: {
  url: string;
  /** Optional secondary paths to probe */
  paths?: string[];
  timeoutMs?: number;
}) {
  const base = params.url.replace(/\/$/, "");
  const paths = params.paths?.length
    ? params.paths
    : ["/healthy", "/healthz", "/"];

  const probes = [];

  for (const path of paths) {
    const fullUrl = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      params.timeoutMs || 10000
    );

    try {
      const res = await fetch(fullUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "text/plain, application/json, */*" },
      });
      const latencyMs = Date.now() - start;
      const body = await res.text().catch(() => "");

      probes.push({
        url: fullUrl,
        ok: res.status >= 200 && res.status < 400,
        statusCode: res.status,
        latencyMs,
        bodyPreview: body.slice(0, 300),
      });
    } catch (err: any) {
      probes.push({
        url: fullUrl,
        ok: false,
        statusCode: null,
        latencyMs: Date.now() - start,
        error: err.name === "AbortError" ? "timeout" : err.message,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  // Also try the explicit helper on /healthy if base was given without path
  const healthyProbe = probes.find((p) => p.url.includes("/healthy")) || probes[0];

  const anyOk = probes.some((p) => p.ok);
  const bestLatency = Math.min(
    ...probes.filter((p) => p.ok).map((p) => p.latencyMs),
    Infinity
  );

  return {
    meta: {
      baseUrl: base,
      checkedAt: new Date().toISOString(),
    },
    healthy: anyOk,
    primary: healthyProbe,
    probes,
    summary: {
      okCount: probes.filter((p) => p.ok).length,
      failCount: probes.filter((p) => !p.ok).length,
      bestLatencyMs: bestLatency === Infinity ? null : bestLatency,
    },
    recommendations: anyOk
      ? [
          "Monitorer latence p95 et error ratio en continu",
          "Alerter si /healthy échoue > N minutes",
          "Corréler volume events GA4 vs trafic attendu",
        ]
      : [
          "Vérifier DNS / TLS du domaine first-party",
          "Vérifier que le tagging server est up (Cloud Run / App Engine)",
          "Confirmer le path /healthy sur le runtime sGTM",
          "Timeout LB > 20s recommandé pour Preview",
        ],
  };
}

/**
 * Lightweight multi-check observability snapshot.
 */
export async function sgtmObservabilitySnapshot(params: {
  sgtmHealthUrl: string;
  propertyId?: string;
}) {
  const health = await checkSgtmHealth({ url: params.sgtmHealthUrl });

  let realtime: any = null;
  if (params.propertyId) {
    try {
      const { runRealtimeReport } = await import("./data-api.js");
      realtime = await runRealtimeReport({
        propertyId: params.propertyId,
        metrics: ["activeUsers", "eventCount"],
        dimensions: ["eventName"],
        limit: 15,
      });
    } catch (err: any) {
      realtime = { error: err.message };
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    health,
    realtime: realtime
      ? {
          activeUsersHint: realtime.rows?.[0] || null,
          topEvents: (realtime.rows || []).slice(0, 10),
          error: realtime.error || null,
        }
      : null,
  };
}
