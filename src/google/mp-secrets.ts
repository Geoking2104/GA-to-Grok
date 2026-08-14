import { getAdminClient } from "./client.js";
import { resolvePropertyId } from "../auth/service-account.js";
import { cacheGet, cacheSet, cacheKey, TTL } from "../cache/redis.js";

function maskSecret(value?: string | null, reveal = false): string | null {
  if (!value) return null;
  if (reveal) return value;
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

/**
 * List data streams for a GA4 property.
 */
export async function listDataStreams(propertyId: string) {
  const id = resolvePropertyId(propertyId);
  const key = cacheKey("data-streams", { propertyId: id });
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _cached: true };

  const client = await getAdminClient();
  const parent = `properties/${id}`;

  const res = await client.properties.dataStreams.list({ parent });
  const streams = (res.data.dataStreams || []).map((s: any) => {
    const streamId = s.name?.split("/").pop();
    const type = s.type; // WEB_DATA_STREAM | ANDROID_APP_DATA_STREAM | IOS_APP_DATA_STREAM

    let measurementId: string | null = null;
    let firebaseAppId: string | null = null;

    if (s.webStreamData) {
      measurementId = s.webStreamData.measurementId || null;
    }
    if (s.androidAppStreamData) {
      firebaseAppId = s.androidAppStreamData.firebaseAppId || null;
    }
    if (s.iosAppStreamData) {
      firebaseAppId = s.iosAppStreamData.firebaseAppId || null;
    }

    return {
      streamId,
      name: s.name,
      displayName: s.displayName,
      type,
      measurementId,
      firebaseAppId,
      createTime: s.createTime,
      updateTime: s.updateTime,
    };
  });

  const result = { propertyId: id, count: streams.length, streams };
  await cacheSet(key, result, TTL.properties);
  return result;
}

/**
 * List Measurement Protocol API secrets for a data stream.
 * secretValue is masked unless revealSecrets=true.
 */
export async function listMeasurementProtocolSecrets(params: {
  propertyId: string;
  dataStreamId: string;
  revealSecrets?: boolean;
}) {
  const id = resolvePropertyId(params.propertyId);
  const streamId = params.dataStreamId.replace(/^.*\//, "");
  const reveal = params.revealSecrets === true;

  const client = await getAdminClient();
  const parent = `properties/${id}/dataStreams/${streamId}`;

  const res = await client.properties.dataStreams.measurementProtocolSecrets.list({
    parent,
  });

  const secrets = (res.data.measurementProtocolSecrets || []).map((s: any) => {
    const secretId = s.name?.split("/").pop();
    return {
      secretId,
      name: s.name,
      displayName: s.displayName,
      secretValue: maskSecret(s.secretValue, reveal),
      secretValueMasked: !reveal,
    };
  });

  return {
    propertyId: id,
    dataStreamId: streamId,
    count: secrets.length,
    secrets,
    note: reveal
      ? "secretValue is fully visible — handle with care"
      : "secretValue is masked (last 4 chars only). Pass revealSecrets=true to show full value.",
  };
}

/**
 * Verify GA4 Measurement Protocol secrets across all streams of a property.
 */
export async function verifyGa4Secrets(params: {
  propertyId: string;
  revealSecrets?: boolean;
}) {
  const id = resolvePropertyId(params.propertyId);
  const reveal = params.revealSecrets === true;

  const streamsResult = await listDataStreams(id);
  const issues: Array<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    code: string;
    message: string;
    recommendation?: string;
  }> = [];

  const streamReports = [];

  for (const stream of streamsResult.streams) {
    let secrets: any[] = [];
    let error: string | null = null;

    try {
      const secretsResult = await listMeasurementProtocolSecrets({
        propertyId: id,
        dataStreamId: stream.streamId,
        revealSecrets: reveal,
      });
      secrets = secretsResult.secrets;
    } catch (err: any) {
      error = err.message;
      issues.push({
        severity: "high",
        code: "SECRETS_LIST_FAILED",
        message: `Impossible de lister les secrets pour le stream "${stream.displayName}" (${stream.streamId}): ${err.message}`,
        recommendation:
          "Vérifier les droits analytics.readonly / accès Admin sur la property",
      });
    }

    const hasSecrets = secrets.length > 0;

    if (!hasSecrets && !error) {
      issues.push({
        severity: stream.type === "WEB_DATA_STREAM" ? "high" : "medium",
        code: "NO_MP_SECRET",
        message: `Aucun Measurement Protocol API secret sur le stream "${stream.displayName}" (${stream.type})`,
        recommendation:
          "Créer un secret dans GA4 Admin → Data Streams → Measurement Protocol API secrets",
      });
    }

    if (stream.type === "WEB_DATA_STREAM" && !stream.measurementId) {
      issues.push({
        severity: "critical",
        code: "NO_MEASUREMENT_ID",
        message: `Stream web "${stream.displayName}" sans Measurement ID`,
        recommendation: "Vérifier la configuration du data stream web",
      });
    }

    streamReports.push({
      streamId: stream.streamId,
      displayName: stream.displayName,
      type: stream.type,
      measurementId: stream.measurementId,
      firebaseAppId: stream.firebaseAppId,
      secretsCount: secrets.length,
      secrets,
      readyForMeasurementProtocol: hasSecrets && !error,
      error,
    });
  }

  const readyCount = streamReports.filter((s) => s.readyForMeasurementProtocol).length;
  const webStreams = streamReports.filter((s) => s.type === "WEB_DATA_STREAM");
  const webReady = webStreams.filter((s) => s.readyForMeasurementProtocol).length;

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 25;
    else if (issue.severity === "high") score -= 15;
    else if (issue.severity === "medium") score -= 8;
    else if (issue.severity === "low") score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";

  return {
    meta: {
      propertyId: id,
      verifiedAt: new Date().toISOString(),
      secretsRevealed: reveal,
    },
    score,
    grade,
    summary: {
      streamsCount: streamReports.length,
      streamsReadyForMp: readyCount,
      webStreamsCount: webStreams.length,
      webStreamsReady: webReady,
      totalSecrets: streamReports.reduce((acc, s) => acc + s.secretsCount, 0),
    },
    streams: streamReports,
    issues,
    recommendations: [
      ...new Set(
        issues.filter((i) => i.recommendation).map((i) => i.recommendation as string)
      ),
    ],
    howToUse: {
      webMpEndpoint:
        "POST https://www.google-analytics.com/mp/collect?measurement_id=G-XXXX&api_secret=SECRET",
      viaSgtm:
        "POST https://tags.example.com/mp/collect (client MP sGTM) — le secret peut être géré côté serveur émetteur",
      docs: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    },
  };
}
