import {
  listGtmAccounts,
  listGtmContainers,
  listGtmWorkspaces,
  listGtmTags,
  getGa4Tags,
  getGtmContainerSummary,
  auditGa4Setup,
  listGtmTriggers,
  getTriggerDetails,
  listGtmVariables,
  getVariableDetails,
  getTagDetails,
} from "../google/tagmanager-api.js";
import {
  analyzeEventParameters,
  compareGtmVsGa4Events,
} from "../google/gtm-ga4-bridge.js";
import { auditGa4SetupV2 } from "../google/gtm-audit-v2.js";

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

export const gtmTools = [
  // ─── Phase 1 ────────────────────────────────────────────────
  {
    name: "list_gtm_accounts",
    description:
      "List all Google Tag Manager accounts accessible with the current credentials. Use this first to discover account IDs.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      try {
        return success(await listGtmAccounts());
      } catch (err: any) {
        return error(err.message || "Failed to list GTM accounts");
      }
    },
  },
  {
    name: "list_gtm_containers",
    description: "List all containers belonging to a GTM account.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "GTM Account ID" },
      },
      required: ["accountId"],
    },
    handler: async (args: any) => {
      try {
        return success(await listGtmContainers(args.accountId));
      } catch (err: any) {
        return error(err.message || "Failed to list GTM containers");
      }
    },
  },
  {
    name: "list_gtm_workspaces",
    description: "List workspaces of a GTM container.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(await listGtmWorkspaces(args.accountId, args.containerId));
      } catch (err: any) {
        return error(err.message || "Failed to list GTM workspaces");
      }
    },
  },
  {
    name: "list_gtm_tags",
    description: "List all tags in a GTM workspace.",
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
          await listGtmTags(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err: any) {
        return error(err.message || "Failed to list GTM tags");
      }
    },
  },
  {
    name: "get_ga4_tags",
    description:
      "List only GA4-related tags (Configuration + Event tags) in a workspace. Useful to understand how data is sent to GA4.",
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
          await getGa4Tags(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err: any) {
        return error(err.message || "Failed to get GA4 tags");
      }
    },
  },
  {
    name: "get_gtm_container_summary",
    description:
      "Get a high-level summary of a GTM container focused on GA4: Measurement IDs found, config tags, event tags.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: {
          type: "string",
          description: "Optional. Defaults to the Default Workspace.",
        },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await getGtmContainerSummary(
            args.accountId,
            args.containerId,
            args.workspaceId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to get container summary");
      }
    },
  },
  {
    name: "audit_ga4_setup",
    description:
      "Basic audit of the GA4 setup inside a GTM container (Phase 1). Prefer audit_ga4_setup_v2 for a complete analysis.",
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
        return success(
          await auditGa4Setup(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err: any) {
        return error(err.message || "Failed to audit GA4 setup");
      }
    },
  },

  // ─── Phase 2 — Triggers & Variables ─────────────────────────
  {
    name: "list_gtm_triggers",
    description:
      "List all triggers in a GTM workspace. Useful to understand when tags fire (All Pages, Click, Custom Event, etc.).",
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
          await listGtmTriggers(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err: any) {
        return error(err.message || "Failed to list GTM triggers");
      }
    },
  },
  {
    name: "get_trigger_details",
    description:
      "Get full details of a specific GTM trigger (type, filters, conditions, custom event name, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        triggerId: { type: "string" },
      },
      required: ["accountId", "containerId", "workspaceId", "triggerId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await getTriggerDetails(
            args.accountId,
            args.containerId,
            args.workspaceId,
            args.triggerId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to get trigger details");
      }
    },
  },
  {
    name: "list_gtm_variables",
    description:
      "List all user-defined variables in a GTM workspace (Data Layer variables, JavaScript variables, constants, etc.).",
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
          await listGtmVariables(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err: any) {
        return error(err.message || "Failed to list GTM variables");
      }
    },
  },
  {
    name: "get_variable_details",
    description: "Get full details of a specific GTM variable (type, parameters, format rules).",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        variableId: { type: "string" },
      },
      required: ["accountId", "containerId", "workspaceId", "variableId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await getVariableDetails(
            args.accountId,
            args.containerId,
            args.workspaceId,
            args.variableId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to get variable details");
      }
    },
  },
  {
    name: "get_tag_details",
    description:
      "Get full enriched details of a specific GTM tag: parameters, eventName, Measurement IDs, and resolved firing/blocking trigger names.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        tagId: { type: "string" },
      },
      required: ["accountId", "containerId", "workspaceId", "tagId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await getTagDetails(
            args.accountId,
            args.containerId,
            args.workspaceId,
            args.tagId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to get tag details");
      }
    },
  },

  // ─── Phase 2 — GA4 data integration ─────────────────────────
  {
    name: "analyze_event_parameters",
    description:
      "Analyze all GA4 Event tags and check whether critical parameters (value, currency, transaction_id, etc.) are present. Extremely useful for ecommerce tracking quality.",
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
          await analyzeEventParameters(
            args.accountId,
            args.containerId,
            args.workspaceId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to analyze event parameters");
      }
    },
  },
  {
    name: "compare_gtm_vs_ga4_events",
    description:
      "Cross-reference events configured in GTM with events actually received in a GA4 property. Shows match rate and discrepancies.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        propertyId: { type: "string", description: "GA4 Property ID" },
        startDate: { type: "string", description: "Default: 30daysAgo" },
        endDate: { type: "string", description: "Default: yesterday" },
      },
      required: ["accountId", "containerId", "workspaceId", "propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await compareGtmVsGa4Events({
            accountId: args.accountId,
            containerId: args.containerId,
            workspaceId: args.workspaceId,
            propertyId: args.propertyId,
            startDate: args.startDate,
            endDate: args.endDate,
          })
        );
      } catch (err: any) {
        return error(err.message || "Failed to compare GTM vs GA4 events");
      }
    },
  },

  // ─── Phase 2 — Full Audit V2 ────────────────────────────────
  {
    name: "audit_ga4_setup_v2",
    description:
      "Full intelligent audit of a GTM container for GA4 quality. Combines configuration checks, parameter quality, trigger validation, and optionally real GA4 data comparison. Returns a score (0-100), grade (A-F), severity-ranked issues and actionable recommendations. Provide propertyId to enable live data cross-check.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "GTM Account ID" },
        containerId: { type: "string", description: "GTM Container ID" },
        workspaceId: {
          type: "string",
          description: "Optional. Defaults to Default Workspace",
        },
        propertyId: {
          type: "string",
          description:
            "Optional GA4 Property ID. When provided, the audit also compares configured vs received events.",
        },
        startDate: {
          type: "string",
          description: "Used only when propertyId is set. Default: 30daysAgo",
        },
        endDate: {
          type: "string",
          description: "Used only when propertyId is set. Default: yesterday",
        },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(
          await auditGa4SetupV2({
            accountId: args.accountId,
            containerId: args.containerId,
            workspaceId: args.workspaceId,
            propertyId: args.propertyId,
            startDate: args.startDate,
            endDate: args.endDate,
          })
        );
      } catch (err: any) {
        return error(err.message || "Failed to run audit v2");
      }
    },
  },
];
