import { getDataClient } from "./client.js";
import { resolvePropertyId } from "../auth/service-account.js";
import { cacheGet, cacheSet, cacheKey, TTL } from "../cache/redis.js";

export interface RunReportParams {
  propertyId?: string;
  metrics: string[];
  dimensions?: string[];
  startDate: string;
  endDate: string;
  limit?: number;
  dimensionFilter?: any;
  metricFilter?: any;
  orderBys?: any[];
  keepEmptyRows?: boolean;
}

export async function runReport(params: RunReportParams) {
  const propertyId = resolvePropertyId(params.propertyId);

  // Build cache key
  const key = cacheKey("report", {
    propertyId,
    metrics: params.metrics,
    dimensions: params.dimensions || [],
    startDate: params.startDate,
    endDate: params.endDate,
    limit: params.limit ?? 100,
    dimensionFilter: params.dimensionFilter,
    metricFilter: params.metricFilter,
    orderBys: params.orderBys,
  });

  // Try cache first
  const cached = await cacheGet(key);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const client = await getDataClient();

  const request: any = {
    dateRanges: [
      {
        startDate: params.startDate,
        endDate: params.endDate,
      },
    ],
    metrics: params.metrics.map((name) => ({ name })),
    dimensions: (params.dimensions || []).map((name) => ({ name })),
    limit: params.limit ?? 100,
    keepEmptyRows: params.keepEmptyRows ?? false,
  };

  if (params.dimensionFilter) request.dimensionFilter = params.dimensionFilter;
  if (params.metricFilter) request.metricFilter = params.metricFilter;
  if (params.orderBys) request.orderBys = params.orderBys;

  const response = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: request,
  });

  const formatted = formatReportResponse(response.data);

  // Store in cache
  await cacheSet(key, formatted, TTL.report);

  return formatted;
}

export async function runRealtimeReport(params: {
  propertyId?: string;
  metrics: string[];
  dimensions?: string[];
  limit?: number;
}) {
  // Realtime is never cached
  const client = await getDataClient();
  const propertyId = resolvePropertyId(params.propertyId);

  const response = await client.properties.runRealtimeReport({
    property: `properties/${propertyId}`,
    requestBody: {
      metrics: params.metrics.map((name) => ({ name })),
      dimensions: (params.dimensions || []).map((name) => ({ name })),
      limit: params.limit ?? 50,
    },
  });

  return formatReportResponse(response.data);
}

export async function getMetadata(propertyId?: string) {
  const id = resolvePropertyId(propertyId);
  const key = cacheKey("metadata", { propertyId: id });

  const cached = await cacheGet(key);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const client = await getDataClient();

  const response = await client.properties.getMetadata({
    name: `properties/${id}/metadata`,
  });

  const data = response.data;

  const result = {
    propertyId: id,
    dimensions: (data.dimensions || []).map((d: any) => ({
      apiName: d.apiName,
      uiName: d.uiName,
      description: d.description,
      category: d.category,
      customDefinition: d.customDefinition || false,
    })),
    metrics: (data.metrics || []).map((m: any) => ({
      apiName: m.apiName,
      uiName: m.uiName,
      description: m.description,
      category: m.category,
      customDefinition: m.customDefinition || false,
      type: m.type,
    })),
  };

  await cacheSet(key, result, TTL.metadata);
  return result;
}

function formatReportResponse(data: any) {
  const dimensionHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
  const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

  const rows = (data.rows || []).map((row: any) => {
    const result: Record<string, string> = {};
    (row.dimensionValues || []).forEach((v: any, i: number) => {
      result[dimensionHeaders[i]] = v.value;
    });
    (row.metricValues || []).forEach((v: any, i: number) => {
      result[metricHeaders[i]] = v.value;
    });
    return result;
  });

  return {
    dimensionHeaders,
    metricHeaders,
    rowCount: data.rowCount ?? rows.length,
    rows,
    metadata: {
      currencyCode: data.metadata?.currencyCode,
      timeZone: data.metadata?.timeZone,
      dataLossFromOtherRow: data.metadata?.dataLossFromOtherRow,
    },
  };
}
