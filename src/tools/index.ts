/**
 * Tool definitions for GA-to-Grok MCP Server
 * 
 * Core tools will be implemented in subsequent commits.
 * Business tools (traffic-overview, top-pages, etc.) are planned.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<any>;
}

export const tools: ToolDefinition[] = [
  {
    name: "list_properties",
    description:
      "List all Google Analytics 4 properties accessible with the current credentials. Use this first to discover available Property IDs.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      // TODO: implement with Admin API
      return {
        content: [
          {
            type: "text",
            text: "list_properties is not yet implemented. Coming in next release.",
          },
        ],
      };
    },
  },
  {
    name: "run_report",
    description:
      "Run a flexible GA4 report. Provide metrics, dimensions, date ranges and optional filters. Prefer this for custom analysis.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "GA4 Property ID (e.g. 123456789). Optional if GA4_PROPERTY_ID is set.",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "List of metric names (e.g. ['activeUsers', 'sessions', 'screenPageViews'])",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description: "List of dimension names (e.g. ['date', 'sessionDefaultChannelGroup', 'pagePath'])",
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD or relative like '7daysAgo')",
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD or relative like 'yesterday')",
        },
        limit: {
          type: "number",
          description: "Maximum number of rows to return (default 100)",
        },
      },
      required: ["metrics", "startDate", "endDate"],
    },
    handler: async (args) => {
      // TODO: implement with Data API
      return {
        content: [
          {
            type: "text",
            text: `run_report called with: ${JSON.stringify(args, null, 2)}\n\nImplementation coming soon.`,
          },
        ],
      };
    },
  },
  {
    name: "run_realtime_report",
    description: "Get realtime data from the last 30 minutes (active users, events, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Realtime metrics (e.g. ['activeUsers', 'eventCount'])",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["metrics"],
    },
    handler: async (args) => {
      return {
        content: [
          {
            type: "text",
            text: "run_realtime_report is not yet implemented.",
          },
        ],
      };
    },
  },
  {
    name: "get_metadata",
    description:
      "Retrieve available dimensions and metrics for a GA4 property (including custom ones).",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
      },
      required: [],
    },
    handler: async () => {
      return {
        content: [
          {
            type: "text",
            text: "get_metadata is not yet implemented.",
          },
        ],
      };
    },
  },
];

export async function handleToolCall(name: string, args: Record<string, any>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  }

  try {
    return await tool.handler(args);
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
