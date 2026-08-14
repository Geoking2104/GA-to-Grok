import { getAdminClient } from "./client.js";
import { resolvePropertyId, assertWriteEnabled } from "../auth/service-account.js";
import {
  listDataStreams,
  listMeasurementProtocolSecrets,
  verifyGa4Secrets,
} from "./mp-secrets.js";

/**
 * Suggest a complete Measurement Protocol configuration for a property.
 */
export async function suggestMeasurementProtocolConfig(params: {
  propertyId: string;
  dataStreamId?: string;
  mode?: "direct" | "sgtm" | "both";
  sgtmBaseUrl?: string;
}) {
  const id = resolvePropertyId(params.propertyId);
  const mode = params.mode || "both";
  const sgtmBaseUrl = (params.sgtmBaseUrl || "https://tags.example.com").replace(/\/$/, "");

  const streams = await listDataStreams(id);
  let targetStreams = streams.streams;

  if (params.dataStreamId) {
    const sid = params.dataStreamId.replace(/^.*\//, "");
    targetStreams = targetStreams.filter((s: any) => s.streamId === sid);
    if (targetStreams.length === 0) {
      throw new Error(`Data stream ${params.dataStreamId} not found on property ${id}`);
    }
  }

  // Prefer web stream if multiple and none specified
  const webStreams = targetStreams.filter((s: any) => s.type === "WEB_DATA_STREAM");
  const primary = webStreams[0] || targetStreams[0];

  if (!primary) {
    throw new Error(`No data stream found on property ${id}`);
  }

  let secretsInfo: any = null;
  try {
    secretsInfo = await listMeasurementProtocolSecrets({
      propertyId: id,
      dataStreamId: primary.streamId,
      revealSecrets: false,
    });
  } catch (err: any) {
    secretsInfo = { error: err.message, count: 0, secrets: [] };
  }

  const measurementId = primary.measurementId || "G-XXXXXXXX";
  const hasSecret = (secretsInfo?.count || 0) > 0;

  const directConfig = {
    enabled: mode === "direct" || mode === "both",
    endpoint: `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=YOUR_API_SECRET`,
    endpointDebug: `https://www.google-analytics.com/debug/mp/collect?measurement_id=${measurementId}&api_secret=YOUR_API_SECRET`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    bodyExampleWeb: {
      client_id: "1234567890.0987654321",
      user_id: "optional-user-id",
      timestamp_micros: "optional",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "T_12345",
            value: 49.99,
            currency: "EUR",
            items: [
              {
                item_id: "SKU_123",
                item_name: "Product",
                quantity: 1,
                price: 49.99,
              },
            ],
          },
        },
      ],
    },
    bodyExampleCustom: {
      client_id: "1234567890.0987654321",
      events: [
        {
          name: "newsletter_signup",
          params: {
            method: "footer_form",
          },
        },
      ],
    },
  };

  const sgtmConfig = {
    enabled: mode === "sgtm" || mode === "both",
    endpoint: `${sgtmBaseUrl}/mp/collect`,
    notes: [
      "Le client Measurement Protocol dans sGTM doit avoir activation path = /mp/collect",
      "Un tag GA4 serveur doit être déclenché sur les events issus de ce client",
      "L'api_secret peut rester côté backend émetteur si vous envoyez ensuite vers GA4 via le tag serveur",
      "Selon le setup, le hit peut aussi être relayé en MP sortant avec secret stocké en variable sGTM",
    ],
    recommendedClient: {
      type: "Measurement Protocol",
      activationPath: "/mp/collect",
    },
  };

  const steps = [
    hasSecret
      ? "1. Secret MP déjà présent — récupérer la valeur dans GA4 Admin ou via list_measurement_protocol_secrets (revealSecrets=true)"
      : "1. Créer un Measurement Protocol API secret (tool create_measurement_protocol_secret ou GA4 Admin → Data stream → MP secrets)",
    "2. Choisir le mode: direct (mp/collect Google) et/ou sGTM (first-party)",
    "3. Depuis le backend, POST JSON avec client_id + events[]",
    "4. Tester d'abord sur l'endpoint /debug/mp/collect",
    "5. Vérifier dans GA4 DebugView / Realtime",
    "6. Pour les conversions, utiliser un event_id / transaction_id stable (dédup)",
  ];

  return {
    propertyId: id,
    primaryStream: primary,
    allStreams: targetStreams,
    secrets: {
      count: secretsInfo?.count || 0,
      hasSecret,
      items: secretsInfo?.secrets || [],
      error: secretsInfo?.error || null,
    },
    mode,
    direct: directConfig,
    sgtm: sgtmConfig,
    implementationSteps: steps,
    validation: {
      requiredFieldsWeb: ["client_id", "events[].name"],
      requiredFieldsApp: ["app_instance_id", "events[].name"],
      ecommercePurchaseRequired: ["transaction_id", "value", "currency"],
    },
    security: [
      "Ne jamais exposer api_secret dans le navigateur ou un repo public",
      "Stocker le secret en variable d'environnement / secret manager",
      "Si sGTM: protéger l'endpoint (/mp/collect) par réseau, auth ou secret partagé",
    ],
  };
}

/**
 * Create a Measurement Protocol API secret on a data stream.
 */
export async function createMeasurementProtocolSecret(params: {
  propertyId: string;
  dataStreamId: string;
  displayName: string;
  dryRun?: boolean;
  confirm?: boolean;
}) {
  assertWriteEnabled();

  const id = resolvePropertyId(params.propertyId);
  const streamId = params.dataStreamId.replace(/^.*\//, "");
  const displayName = params.displayName?.trim();
  const dryRun = params.dryRun === true;
  const confirm = params.confirm === true;

  if (!displayName) {
    throw new Error("displayName is required");
  }

  if (!confirm && !dryRun) {
    throw new Error(
      "Safety check: pass confirm=true to create the secret, or dryRun=true to preview."
    );
  }

  // Check existing
  let existing: any[] = [];
  try {
    const listed = await listMeasurementProtocolSecrets({
      propertyId: id,
      dataStreamId: streamId,
      revealSecrets: false,
    });
    existing = listed.secrets || [];
  } catch {
    // continue
  }

  const duplicate = existing.find(
    (s) => (s.displayName || "").toLowerCase() === displayName.toLowerCase()
  );

  const payload = {
    displayName,
  };

  if (dryRun) {
    return {
      dryRun: true,
      wouldCreate: {
        parent: `properties/${id}/dataStreams/${streamId}`,
        ...payload,
      },
      existingSecretsCount: existing.length,
      duplicateName: !!duplicate,
    };
  }

  if (duplicate) {
    return {
      created: false,
      reason: "A secret with this displayName already exists",
      existing: duplicate,
      note: "GA4 allows multiple secrets; use a unique displayName or reuse the existing one.",
    };
  }

  const client = await getAdminClient();
  const parent = `properties/${id}/dataStreams/${streamId}`;

  const res = await client.properties.dataStreams.measurementProtocolSecrets.create({
    parent,
    requestBody: payload,
  });

  const secret = res.data;

  return {
    created: true,
    secret: {
      name: secret.name,
      secretId: secret.name?.split("/").pop(),
      displayName: secret.displayName,
      // Full value returned once at creation — critical to store securely
      secretValue: secret.secretValue,
    },
    warning:
      "Store secretValue immediately in a secret manager. It may not be shown again in full depending on UI/API usage.",
    nextSteps: [
      "Sauvegarder secretValue hors git",
      "Tester avec /debug/mp/collect",
      "Brancher le backend ou sGTM",
      "verify_ga4_secrets pour confirmer la présence",
    ],
  };
}

/**
 * High-level configure helper: verify + suggest + optional create guidance.
 */
export async function configureMeasurementProtocol(params: {
  propertyId: string;
  dataStreamId?: string;
  mode?: "direct" | "sgtm" | "both";
  sgtmBaseUrl?: string;
  createSecretName?: string;
  dryRun?: boolean;
  confirm?: boolean;
}) {
  const id = resolvePropertyId(params.propertyId);

  const verification = await verifyGa4Secrets({
    propertyId: id,
    revealSecrets: false,
  });

  const suggestion = await suggestMeasurementProtocolConfig({
    propertyId: id,
    dataStreamId: params.dataStreamId,
    mode: params.mode,
    sgtmBaseUrl: params.sgtmBaseUrl,
  });

  let creation: any = null;
  if (params.createSecretName) {
    const streamId =
      params.dataStreamId ||
      suggestion.primaryStream?.streamId;

    if (!streamId) {
      throw new Error("No dataStreamId available to create a secret");
    }

    creation = await createMeasurementProtocolSecret({
      propertyId: id,
      dataStreamId: streamId,
      displayName: params.createSecretName,
      dryRun: params.dryRun,
      confirm: params.confirm,
    });
  }

  return {
    propertyId: id,
    verification: {
      score: verification.score,
      grade: verification.grade,
      summary: verification.summary,
      issues: verification.issues,
    },
    configuration: suggestion,
    secretCreation: creation,
  };
}
