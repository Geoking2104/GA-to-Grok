import {
  listDataStreams,
  listMeasurementProtocolSecrets,
  verifyGa4Secrets,
} from "../google/mp-secrets.js";

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
      "List GA4 data streams for a property (web / Android / iOS), including Measurement IDs and Firebase App IDs.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "GA4 Property ID" },
      },
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
      "List Measurement Protocol API secrets for a specific GA4 data stream. Secret values are masked by default (last 4 chars). Set revealSecrets=true to show full values.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        dataStreamId: {
          type: "string",
          description: "Data stream ID (from list_data_streams)",
        },
        revealSecrets: {
          type: "boolean",
          description: "If true, return full secretValue (sensitive)",
        },
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
      "Verify Measurement Protocol API secrets across all data streams of a GA4 property. Reports streams missing secrets, readiness for server-side / MP hits, score and recommendations. Secrets masked by default.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "GA4 Property ID" },
        revealSecrets: {
          type: "boolean",
          description: "If true, include full secret values (sensitive)",
        },
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
];
