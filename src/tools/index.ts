import { runReport, runRealtimeReport, getMetadata } from "../google/data-api.js";
import { listProperties, getPropertyDetails } from "../google/admin-api.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<any>;
}

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
    content: [
      {
        type: "text" as const,
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}

export const tools: ToolDefinition[] = [
  {
    name: "list_properties",
    description:
      "List all Google Analytics 4 properties accessible with the current Service Account credentials. Always call this first if you don't know the Property ID.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      try {
        const result = await listProperties();
        return success(result);
      } catch (err: any) {
        return error(err.message || "Failed to list properties");
      }
    },
  },
  {
    name: "get_property_details",
    description: "Get detailed information about a specific GA4 property.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "GA4 Property ID (e.g. 123456789)",
        },
      },
      required: ["propertyId"],
    },
    handler: async (args) => {
      try {
        const result = await getPropertyDetails(args.propertyId);
        return success(result);
      } catch (err: any) {
        return error(err.message || "Failed to get property details");
      }
    },
  },
  {
    name: "get_metadata",
    description:
      "Retrieve all available dimensions and metrics (including custom ones) for a GA4 property. Useful before building complex reports.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "GA4 Property ID. Optional if GA4_PROPERTY_ID is set in environment.",
        },
      },
      required: [],
    },
    handler: async (args) => {
      try {
        const result = await getMetadata(args.propertyId);
        return success(result);
      } catch (err: any) {
        return error(err.message || "Failed to get metadata");
      }
    },
  },
  {
    name: "run_report",
    description:
      "Run a flexible GA4 report. Provide metrics, dimensions and date ranges. Use relative dates like '7daysAgo', 'yesterday', '30daysAgo' or absolute YYYY-MM-DD.",
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
          description:
            "List of metric names. Common ones: activeUsers, sessions, screenPageViews, bounceRate, averageSessionDuration, conversions, totalRevenue, eventCount",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description:
            "List of dimension names. Common ones: date, sessionDefaultChannelGroup, pagePath, pageTitle, country, deviceCategory, source, medium",
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD or relative: 7daysAgo, 30daysAgo, yesterday)",
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD or relative: yesterday, today)",
        },
        limit: {
          type: "number",
          description: "Maximum number of rows to return (default 100, max 100000)",
        },
      },
      required: ["metrics", "startDate", "endDate"],
    },
    handler: async (args) => {
      try {
        if (!args.metrics || !Array.isArray(args.metrics) || args.metrics.length === 0) {
          return error("metrics is required and must be a non-empty array");
        }
        const result = await runReport({
          propertyId: args.propertyId,
          metrics: args.metrics,
          dimensions: args.dimensions,
          startDate: args.startDate,
          endDate: args.endDate,
          limit: args.limit,
        });
        return success(result);
      } catch (err: any) {
        return error(err.message || "Failed to run report");
      }
    },
  },
  {
    name: "run_realtime_report",
    description:
      "Get realtime data from the last 30 minutes (active users right now, events, pages, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "GA4 Property ID. Optional if GA4_PROPERTY_ID is set.",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Realtime metrics. Common: activeUsers, eventCount, conversions, screenPageViews",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description: "Realtime dimensions. Common: unifiedScreenName, country, deviceCategory, eventName",
        },
        limit: {
          type: "number",
          description: "Max rows (default 50)",
        },
      },
      required: ["metrics"],
    },
    handler: async (args) => {
      try {
        if (!args.metrics || !Array.isArray(args.metrics) || args.metrics.length === 0) {
          return error("metrics is required and must be a non-empty array");
        }
        const result = await runRealtimeReport({
          propertyId: args.propertyId,
          metrics: args.metrics,
          dimensions: args.dimensions,
          limit: args.limit,
        });
        return success(result);
      } catch (err: any) {
        return error(err.message || "Failed to run realtime report");
      }
    },
  },
];

export async function handleToolCall(name: string, args: Record<string, any>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return error(`Unknown tool: ${name}`);
  }

  try {
    return await tool.handler(args);
  } catch (err: any) {
    return error(`Unexpected error in ${name}: ${err.message}`);
  }
}
