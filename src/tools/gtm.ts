import {
  listGtmAccounts,
  listGtmContainers,
  listGtmWorkspaces,
  listGtmTags,
  getGa4Tags,
  getGtmContainerSummary,
  auditGa4Setup,
} from "../google/tagmanager-api.js";

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
  {
    name: "list_gtm_accounts",
    description:
      "List all Google Tag Manager accounts accessible with the current credentials. Use this first to discover account IDs.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
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
        accountId: {
          type: "string",
          description: "GTM Account ID",
        },
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
        return success(
          await listGtmWorkspaces(args.accountId, args.containerId)
        );
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
      "Perform an intelligent audit of the GA4 setup inside a GTM container. Returns a score, warnings, missing recommended events and actionable recommendations.",
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
          await auditGa4Setup(
            args.accountId,
            args.containerId,
            args.workspaceId
          )
        );
      } catch (err: any) {
        return error(err.message || "Failed to audit GA4 setup");
      }
    },
  },
];
