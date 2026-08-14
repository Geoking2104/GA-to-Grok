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
import { validateEcommerceEvents } from "../google/ecommerce-validation.js";

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
  // ─── Discovery ──────────────────────────────────────────────
  {
    name: "list_gtm_accounts",
    description: "List all Google Tag Manager accounts accessible with the current credentials.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      try { return success(await listGtmAccounts()); }
      catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "list_gtm_containers",
    description: "List all containers belonging to a GTM account.",
    inputSchema: {
      type: "object",
      properties: { accountId: { type: "string" } },
      required: ["accountId"],
    },
    handler: async (args: any) => {
      try { return success(await listGtmContainers(args.accountId)); }
      catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "list_gtm_workspaces",
    description: "List workspaces of a GTM container.",
    inputSchema: {
      type: "object",
      properties: { accountId: { type: "string" }, containerId: { type: "string" } },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try { return success(await listGtmWorkspaces(args.accountId, args.containerId)); }
      catch (err: any) { return error(err.message); }
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
        return success(await listGtmTags(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "get_ga4_tags",
    description: "List only GA4 Configuration + Event tags in a workspace.",
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
        return success(await getGa4Tags(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "get_gtm_container_summary",
    description: "High-level GA4-focused summary of a GTM container.",
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
        return success(await getGtmContainerSummary(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },

  // ─── Triggers & Variables ───────────────────────────────────
  {
    name: "list_gtm_triggers",
    description: "List all triggers in a GTM workspace.",
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
        return success(await listGtmTriggers(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "get_trigger_details",
    description: "Get full details of a specific GTM trigger.",
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
        return success(await getTriggerDetails(args.accountId, args.containerId, args.workspaceId, args.triggerId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "list_gtm_variables",
    description: "List all user-defined variables in a GTM workspace.",
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
        return success(await listGtmVariables(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "get_variable_details",
    description: "Get full details of a specific GTM variable.",
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
        return success(await getVariableDetails(args.accountId, args.containerId, args.workspaceId, args.variableId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "get_tag_details",
    description: "Get full enriched details of a GTM tag (parameters, triggers, eventName…).",
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
        return success(await getTagDetails(args.accountId, args.containerId, args.workspaceId, args.tagId));
      } catch (err: any) { return error(err.message); }
    },
  },

  // ─── Analysis & Audit ───────────────────────────────────────
  {
    name: "analyze_event_parameters",
    description: "Check critical parameters on all GA4 Event tags (value, currency, transaction_id…).",
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
        return success(await analyzeEventParameters(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "compare_gtm_vs_ga4_events",
    description: "Cross-reference GTM configured events vs events actually received in GA4.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["accountId", "containerId", "workspaceId", "propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(await compareGtmVsGa4Events(args));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "audit_ga4_setup",
    description: "Basic GA4 setup audit (Phase 1). Prefer audit_ga4_setup_v2.",
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
        return success(await auditGa4Setup(args.accountId, args.containerId, args.workspaceId));
      } catch (err: any) { return error(err.message); }
    },
  },
  {
    name: "audit_ga4_setup_v2",
    description:
      "Full intelligent audit of a GTM container for GA4. Combines config checks, parameter quality, triggers, and optional live GA4 data comparison. Returns score, grade, issues and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        propertyId: { type: "string", description: "Optional — enables live data cross-check" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["accountId", "containerId"],
    },
    handler: async (args: any) => {
      try {
        return success(await auditGa4SetupV2(args));
      } catch (err: any) { return error(err.message); }
    },
  },

  // ─── Ecommerce validation ───────────────────────────────────
  {
    name: "validate_ecommerce_events",
    description:
      "Validate GA4 ecommerce events against the official Google schema (purchase, add_to_cart, begin_checkout, view_item, etc.). Checks required/recommended parameters, items array, triggers, and optionally cross-checks with real GA4 revenue & event counts. Returns a funnel score and actionable fixes.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "GTM Account ID" },
        containerId: { type: "string", description: "GTM Container ID" },
        workspaceId: { type: "string", description: "GTM Workspace ID" },
        propertyId: {
          type: "string",
          description: "Optional GA4 Property ID — enables live event count & revenue check",
        },
        startDate: { type: "string", description: "Default: 30daysAgo" },
        endDate: { type: "string", description: "Default: yesterday" },
      },
      required: ["accountId", "containerId", "workspaceId"],
    },
    handler: async (args: any) => {
      try {
        return success(await validateEcommerceEvents(args));
      } catch (err: any) {
        return error(err.message || "Failed to validate ecommerce events");
      }
    },
  },
];
