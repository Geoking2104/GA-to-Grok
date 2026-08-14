import {
  listSgtmContainers,
  listGtmClients,
  getGtmClientDetails,
  auditSgtmSetup,
} from "../google/sgtm-api.js";
import { auditMeasurementProtocolClient } from "../google/mp-client-audit.js";

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

export const sgtmTools = [
  {
    name: "list_sgtm_containers",
    description:
      "List all server-side GTM containers (usageContext SERVER) accessible with current credentials.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      try {
        return success(await listSgtmContainers());
      } catch (err: any) {
        return error(err.message || "Failed to list sGTM containers");
      }
    },
  },
  {
    name: "list_gtm_clients",
    description:
      "List clients in a GTM workspace (GA4 Client, Measurement Protocol Client, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
      },
      required: ["accountId", "containerId", "workspaceId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await listGtmClients(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err: any) {
        return error(err.message || "Failed to list GTM clients");
      }
    },
  },
  {
    name: "get_gtm_client_details",
    description: "Get full details of a specific GTM client.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        clientId: { type: "string" },
      },
      required: ["accountId", "containerId", "workspaceId", "clientId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await getGtmClientDetails(
            args.accountId,
            args.containerId,
            args.workspaceId,
            args.clientId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to get client details");
      }
    },
  },
  {
    name: "audit_sgtm_setup",
    description:
      "Audit a server-side GTM container for GA4 readiness (clients, GA4 tags, MP, legacy UA).",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(await auditSgtmSetup(args));
      } catch (err: any) {
        return error(err.message || "Failed to audit sGTM setup");
      }
    },
  },
  {
    name: "audit_measurement_protocol_client",
    description:
      "Deep technical audit of the Measurement Protocol client(s) in an sGTM workspace: activation path, collisions with /g/collect, priority, downstream GA4 tags/triggers, security and schema checklist. Optionally focus on one clientId.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: {
          type: "string",
          description: "Optional — defaults to Default Workspace",
        },
        clientId: {
          type: "string",
          description: "Optional — audit a specific MP client only",
        },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(await auditMeasurementProtocolClient(args));
      } catch (err: any) {
        return error(err.message || "Failed to audit Measurement Protocol client");
      }
    },
  },
];
