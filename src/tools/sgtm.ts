import {
  listSgtmContainers,
  listGtmClients,
  getGtmClientDetails,
  auditSgtmSetup,
} from "../google/sgtm-api.js";
import { auditMeasurementProtocolClient } from "../google/mp-client-audit.js";
import { compareDualTagging } from "../google/sgtm-dual-tagging.js";
import { cutoverChecklist } from "../google/sgtm-cutover.js";
import {
  checkSgtmHealth,
  sgtmObservabilitySnapshot,
} from "../google/sgtm-health.js";

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
    description: "List server-side GTM containers (usageContext SERVER).",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      try {
        return success(await listSgtmContainers());
      } catch (err: any) {
        return error(err.message);
      }
    },
  },
  {
    name: "list_gtm_clients",
    description: "List clients in a GTM workspace (sGTM entry points).",
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
        return error(err.message);
      }
    },
  },
  {
    name: "get_gtm_client_details",
    description: "Get full details of a GTM client.",
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
        return error(err.message);
      }
    },
  },
  {
    name: "audit_sgtm_setup",
    description: "Audit server-side GTM container for GA4 readiness.",
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
        return error(err.message);
      }
    },
  },
  {
    name: "audit_measurement_protocol_client",
    description: "Deep technical audit of Measurement Protocol client(s) in sGTM.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        clientId: { type: "string" },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(await auditMeasurementProtocolClient(args));
      } catch (err: any) {
        return error(err.message);
      }
    },
  },

  // ─── S3 Dual-tagging ────────────────────────────────────────
  {
    name: "compare_dual_tagging",
    description:
      "S3: Compare web GTM vs sGTM vs events actually received in GA4. Returns match rates, missing events, server readiness signals and migration risks.",
    inputSchema: {
      type: "object",
      properties: {
        webAccountId: { type: "string" },
        webContainerId: { type: "string" },
        webWorkspaceId: { type: "string" },
        serverAccountId: { type: "string" },
        serverContainerId: { type: "string" },
        serverWorkspaceId: { type: "string" },
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: [
        "webAccountId",
        "webContainerId",
        "serverAccountId",
        "serverContainerId",
        "propertyId",
      ],
    },
    handler: async (args: any) => {
      try {
        return success(await compareDualTagging(args));
      } catch (err: any) {
        return error(err.message || "Failed dual-tagging comparison");
      }
    },
  },

  // ─── S4 Cutover checklist ───────────────────────────────────
  {
    name: "cutover_checklist",
    description:
      "S4: Automated readiness checklist for sGTM dual-tagging / cutover. Combines web audit, sGTM audit, MP secrets, parity, ecommerce quality and optional /healthy probe. Returns readyForDualTagging / readyForCutover flags.",
    inputSchema: {
      type: "object",
      properties: {
        webAccountId: { type: "string" },
        webContainerId: { type: "string" },
        webWorkspaceId: { type: "string" },
        serverAccountId: { type: "string" },
        serverContainerId: { type: "string" },
        serverWorkspaceId: { type: "string" },
        propertyId: { type: "string" },
        sgtmHealthUrl: {
          type: "string",
          description: "e.g. https://tags.example.com/healthy",
        },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: [
        "webAccountId",
        "webContainerId",
        "serverAccountId",
        "serverContainerId",
        "propertyId",
      ],
    },
    handler: async (args: any) => {
      try {
        return success(await cutoverChecklist(args));
      } catch (err: any) {
        return error(err.message || "Failed cutover checklist");
      }
    },
  },

  // ─── S5 Health / observability ──────────────────────────────
  {
    name: "check_sgtm_health",
    description:
      "S5: Probe sGTM health endpoints (/healthy, /healthz, /) and report status codes + latency.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Base URL or full health URL, e.g. https://tags.example.com",
        },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Optional paths to probe",
        },
        timeoutMs: { type: "number" },
      },
      required: ["url"],
    },
    handler: async (args: any) => {
      try {
        return success(await checkSgtmHealth(args));
      } catch (err: any) {
        return error(err.message || "Failed sGTM health check");
      }
    },
  },
  {
    name: "sgtm_observability_snapshot",
    description:
      "S5: Combined snapshot — sGTM health probe + optional GA4 realtime event activity.",
    inputSchema: {
      type: "object",
      properties: {
        sgtmHealthUrl: { type: "string" },
        propertyId: {
          type: "string",
          description: "Optional — include realtime GA4 activity",
        },
      },
      required: ["sgtmHealthUrl"],
    },
    handler: async (args: any) => {
      try {
        return success(await sgtmObservabilitySnapshot(args));
      } catch (err: any) {
        return error(err.message || "Failed observability snapshot");
      }
    },
  },
];
