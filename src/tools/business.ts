import { runReport } from "../google/data-api.js";
import { normalizeDate } from "../utils/dates.js";

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

/**
 * High-level business tools optimized for Grok / agents.
 * They call the underlying runReport with sensible defaults.
 */

export async function getTrafficOverview(args: {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const startDate = normalizeDate(args.startDate || "7daysAgo");
    const endDate = normalizeDate(args.endDate || "yesterday");

    const result = await runReport({
      propertyId: args.propertyId,
      metrics: [
        "activeUsers",
        "sessions",
        "screenPageViews",
        "bounceRate",
        "averageSessionDuration",
        "newUsers",
      ],
      dimensions: ["date"],
      startDate,
      endDate,
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 90,
    });

    // Also compute totals
    const totals = await runReport({
      propertyId: args.propertyId,
      metrics: [
        "activeUsers",
        "sessions",
        "screenPageViews",
        "bounceRate",
        "averageSessionDuration",
        "newUsers",
      ],
      startDate,
      endDate,
      limit: 1,
    });

    return success({
      period: { startDate, endDate },
      totals: totals.rows?.[0] || {},
      daily: result.rows,
    });
  } catch (err: any) {
    return error(err.message);
  }
}

export async function getTopPages(args: {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    const startDate = normalizeDate(args.startDate || "7daysAgo");
    const endDate = normalizeDate(args.endDate || "yesterday");
    const limit = args.limit || 20;

    const result = await runReport({
      propertyId: args.propertyId,
      metrics: ["screenPageViews", "activeUsers", "averageSessionDuration"],
      dimensions: ["pagePath", "pageTitle"],
      startDate,
      endDate,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit,
    });

    return success({
      period: { startDate, endDate },
      topPages: result.rows,
    });
  } catch (err: any) {
    return error(err.message);
  }
}

export async function getAcquisition(args: {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    const startDate = normalizeDate(args.startDate || "7daysAgo");
    const endDate = normalizeDate(args.endDate || "yesterday");
    const limit = args.limit || 15;

    const result = await runReport({
      propertyId: args.propertyId,
      metrics: ["sessions", "activeUsers", "newUsers", "bounceRate"],
      dimensions: ["sessionDefaultChannelGroup", "source", "medium"],
      startDate,
      endDate,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit,
    });

    return success({
      period: { startDate, endDate },
      acquisition: result.rows,
    });
  } catch (err: any) {
    return error(err.message);
  }
}

export async function getDevices(args: {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const startDate = normalizeDate(args.startDate || "7daysAgo");
    const endDate = normalizeDate(args.endDate || "yesterday");

    const result = await runReport({
      propertyId: args.propertyId,
      metrics: ["activeUsers", "sessions", "screenPageViews", "bounceRate"],
      dimensions: ["deviceCategory", "operatingSystem", "browser"],
      startDate,
      endDate,
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 30,
    });

    return success({
      period: { startDate, endDate },
      devices: result.rows,
    });
  } catch (err: any) {
    return error(err.message);
  }
}

export async function getEventsSummary(args: {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    const startDate = normalizeDate(args.startDate || "7daysAgo");
    const endDate = normalizeDate(args.endDate || "yesterday");
    const limit = args.limit || 20;

    const result = await runReport({
      propertyId: args.propertyId,
      metrics: ["eventCount", "activeUsers"],
      dimensions: ["eventName"],
      startDate,
      endDate,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit,
    });

    return success({
      period: { startDate, endDate },
      events: result.rows,
    });
  } catch (err: any) {
    return error(err.message);
  }
}
