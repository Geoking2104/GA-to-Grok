import { runReport, runRealtimeReport, getMetadata } from "../google/data-api.js";
import { listProperties, getPropertyDetails } from "../google/admin-api.js";
import {
  getTrafficOverview,
  getTopPages,
  getAcquisition,
  getDevices,
  getEventsSummary,
  getEcommerceAnalysis,
} from "./business.js";
import { gtmTools } from "./gtm.js";

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

const coreAndBusinessTools: ToolDefinition[] = [
  {
    name: "list_properties",
    description:
      "List all Google Analytics 4 properties accessible with the current Service Account credentials.",
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
        propertyId: { type: "string" },
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
    description: "Retrieve available dimensions and metrics for a GA4 property.",
    inputSchema: {
      type: "object",
      properties: { propertyId: { type: "string" } },
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
  {
    name: "run_report",
    description: "Run a flexible GA4 report. Prefer business tools when possible.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        metrics: { type: "array", items: { type: "string" } },
        dimensions: { type: "array", items: { type: "string" } },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number" },
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
        metrics: { type: "array", items: { type: "string" } },
        dimensions: { type: "array", items: { type: "string" } },
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

  // Business tools
  {
    name: "get_traffic_overview",
    description: "Complete traffic overview (users, sessions, pageviews, bounce rate…).",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: [],
    },
    handler: getTrafficOverview,
  },
  {
    name: "get_top_pages",
    description: "Most viewed pages for a period.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
    handler: getTopPages,
  },
  {
    name: "get_acquisition",
    description: "Traffic acquisition by channel, source and medium.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
    handler: getAcquisition,
  },
  {
    name: "get_devices",
    description: "Traffic breakdown by device, OS and browser.",
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
    description: "Most frequent events for a period.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
    handler: getEventsSummary,
  },
  {
    name: "analyze_ecommerce_data",
    description:
      "Analyze real ecommerce performance from GA4: purchases, revenue, AOV, funnel conversion rates (view_item → add_to_cart → checkout → purchase), top items, daily trend, and data-quality warnings (zero-revenue purchases, missing purchase events, suspicious AOV…).",",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "GA4 Property ID (required)",
        },
        startDate: {
          type: "string",
          description: "Default: 30daysAgo",
        },
        endDate: {
          type: "string",
          description: "Default: yesterday",
        },
        limit: {
          type: "number",
          description: "Max top items to return (default 20)",
        },
      },
      required: ["propertyId"],
    },
    handler: getEcommerceAnalysis,
  },
];

export const tools: ToolDefinition[] = [
  ...coreAndBusinessTools,
  ...gtmTools,
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
