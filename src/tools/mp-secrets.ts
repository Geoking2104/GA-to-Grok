import {
  listDataStreams,
  listMeasurementProtocolSecrets,
  verifyGa4Secrets,
} from "../google/mp-secrets.js";
import {
  suggestMeasurementProtocolConfig,
  createMeasurementProtocolSecret,
  configureMeasurementProtocol,
} from "../google/mp-config.js";

function success(data: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function error(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export const mpSecretsTools = [
  {
    name: "list_data_streams",
    description:
      "List GA4 data streams for a property (web / Android / iOS), including Measurement IDs.",
    inputSchema: {
      type: "object",
      properties: { propertyId: { type: "string" } },
      required: ["propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(await listDataStreams(args.propertyId));
      } catch (err: any) {
        return error(err.message || "Failed to list data streams");
      }
    },
  },
  {
    name: "list_measurement_protocol_secrets",
    description:
      "List Measurement Protocol API secrets for a data stream. Values masked by default.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        dataStreamId: { type: "string" },
        revealSecrets: { type: "boolean" },
      },
      required: ["propertyId", "dataStreamId"],
    },
    handler: async (args: any) => {
      try {
        return success(await listMeasurementProtocolSecrets(args));
      } catch (err: any) {
        return error(err.message || "Failed to list MP secrets");
      }
    },
  },
  {
    name: "verify_ga4_secrets",
    description:
      "Verify MP secrets across all streams of a GA4 property. Score, issues, readiness.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        revealSecrets: { type: "boolean" },
      },
      required: ["propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(await verifyGa4Secrets(args));
      } catch (err: any) {
        return error(err.message || "Failed to verify GA4 secrets");
      }
    },
  },
  {
    name: "suggest_measurement_protocol_config",
    description:
      "Generate a complete Measurement Protocol setup for a GA4 property: endpoints (direct + debug), payload examples, sGTM path, security notes and implementation steps. Uses real stream/secret status when available.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        dataStreamId: {
          type: "string",
          description: "Optional — defaults to primary web stream",
        },
        mode: {
          type: "string",
          description: "direct | sgtm | both (default both)",
        },
        sgtmBaseUrl: {
          type: "string",
          description: "e.g. https://tags.example.com",
        },
      },
      required: ["propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(await suggestMeasurementProtocolConfig(args));
      } catch (err: any) {
        return error(err.message || "Failed to suggest MP config");
      }
    },
  },
  {
    name: "create_measurement_protocol_secret",
    description:
      "WRITE: Create a Measurement Protocol API secret on a GA4 data stream. Requires analytics.edit. Use dryRun=true to preview, confirm=true to execute. Returns secretValue once — store securely.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        dataStreamId: { type: "string" },
        displayName: {
          type: "string",
          description: "Human-readable name, e.g. backend-prod",
        },
        dryRun: { type: "boolean" },
        confirm: { type: "boolean" },
      },
      required: ["propertyId", "dataStreamId", "displayName"],
    },
    handler: async (args: any) => {
      try {
        return success(await createMeasurementProtocolSecret(args));
      } catch (err: any) {
        return error(err.message || "Failed to create MP secret");
      }
    },
  },
  {
    name: "configure_measurement_protocol",
    description:
      "End-to-end Measurement Protocol configuration helper: verifies secrets, suggests direct/sGTM setup, and optionally creates a secret (createSecretName + confirm).",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        dataStreamId: { type: "string" },
        mode: { type: "string", description: "direct | sgtm | both" },
        sgtmBaseUrl: { type: "string" },
        createSecretName: {
          type: "string",
          description: "If set, attempt to create a secret with this displayName",
        },
        dryRun: { type: "boolean" },
        confirm: { type: "boolean" },
      },
      required: ["propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(await configureMeasurementProtocol(args));
      } catch (err: any) {
        return error(err.message || "Failed to configure Measurement Protocol");
      }
    },
  },
];
