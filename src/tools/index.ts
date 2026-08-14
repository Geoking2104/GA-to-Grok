import { runReport, runRealtimeReport, getMetadata } from "../google/data-api.js";
import { listProperties, getPropertyDetails } from "../google/admin-api.js";
import {
  getTrafficOverview,
  getTopPages,
  getAcquisition,
  getDevices,
  getEventsSummary,
} from "./business.js";

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
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export const tools: ToolDefinition[] = [
  // ─── Discovery ───────────────────────────────────────────────
  {
    name: "list_properties",
    description:
      "List all Google Analytics 4 properties accessible with the current Service Account credentials. Always call this first if you don't know the Property ID.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      try {
        return success(await listProperties());
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
        propertyId: { type: "string", description: "GA4 Property ID (e.g. 123456789)" },
      },
      required: ["propertyId"],
    },
    handler: async (args) => {
      try {
        return success(await getPropertyDetails(args.propertyId));
      } catch (err: any) {
        return error(err.message || "Failed to get property details");
      }
    },
  },
  {
    name: "get_metadata",
    description:
      "Retrieve all available dimensions and metrics (including custom ones) for a GA4 property.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "GA4 Property ID. Optional if GA4_PROPERTY_ID is set.",
        },
      },
      required: [],
    },
    handler: async (args) => {
      try {
        return success(await getMetadata(args.propertyId));
      } catch (err: any) {
        return error(err.message || "Failed to get metadata");
      }
    },
  },

  // ─── Core flexible report ────────────────────────────────────
  {
    name: "run_report",
    description:
      "Run a flexible GA4 report. Provide metrics, dimensions and date ranges. Prefer the business tools when possible.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['activeUsers', 'sessions', 'screenPageViews']",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['date', 'sessionDefaultChannelGroup', 'pagePath']",
        },
        startDate: {
          type: "string",
          description: "YYYY-MM-DD or relative (7daysAgo, yesterday, 30daysAgo)",
        },
        endDate: {
          type: "string",
          description: "YYYY-MM-DD or relative (yesterday, today)",
        },
        limit: { type: "number", description: "Max rows (default 100)" },
      },
      required: ["metrics", "startDate", "endDate"],
    },
    handler: async (args) => {
      try {
        if (!args.metrics?.length) return error("metrics is required");
        return success(
          await runReport({
            propertyId: args.propertyId,
            metrics: args.metrics,
            dimensions: args.dimensions,
            startDate: args.startDate,
            endDate: args.endDate,
            limit: args.limit,
          })
        );
      } catch (err: any) {
        return error(err.message || "Failed to run report");
      }
    },
  },
  {
    name: "run_realtime_report",
    description: "Get realtime data from the last 30 minutes.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['activeUsers', 'eventCount']",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
        },
        limit: { type: "number" },
      },
      required: ["metrics"],
    },
    handler: async (args) => {
      try {
        if (!args.metrics?.length) return error("metrics is required");
        return success(
          await runRealtimeReport({
            propertyId: args.propertyId,
            metrics: args.metrics,
            dimensions: args.dimensions,
            limit: args.limit,
          })
        );
      } catch (err: any) {
        return error(err.message || "Failed to run realtime report");
      }
    },
  },

  // ─── Business tools (recommended for Grok) ───────────────────
  {
    name: "get_traffic_overview",
    description:
      "Get a complete traffic overview (users, sessions, pageviews, bounce rate, new users) for a period. Best starting point for most questions.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: {
          type: "string",
          description: "Default: 7daysAgo",
        },
        endDate: {
          type: "string",
          description: "Default: yesterday",
        },
      },
      required: [],
    },
    handler: getTrafficOverview,
  },
  {
    name: "get_top_pages",
    description: "Get the most viewed pages for a period.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", description: "Default 20" },
      },
      required: [],
    },
    handler: getTopPages,
  },
  {
    name: "get_acquisition",
    description: "Get traffic acquisition by channel, source and medium.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", description: "Default 15" },
      },
      required: [],
    },
    handler: getAcquisition,
  },
  {
    name: "get_devices",
    description: "Get traffic breakdown by device category, OS and browser.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: [],
    },
    handler: getDevices,
  },
  {
    name: "get_events_summary",
    description: "Get the most frequent events for a period.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", description: "Default 20" },
      },
      required: [],
    },
    handler: getEventsSummary,
  },
];

export async function handleToolCall(name: string, args: Record<string, any>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return error(`Unknown tool: ${name}`);
  }

  try {
    return await tool.handler(args ?? {});
  } catch (err: any) {
    return error(`Unexpected error in ${name}: ${err.message}`);
  }
}
