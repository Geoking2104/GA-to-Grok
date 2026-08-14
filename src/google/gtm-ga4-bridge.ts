import { getGa4Tags, listGtmTags, getTagDetails } from "./tagmanager-api.js";
import { runReport } from "./data-api.js";

/** Critical parameters that should be present for ecommerce events */
const CRITICAL_PARAMS: Record<string, string[]> = {
  purchase: ["value", "currency", "transaction_id"],
  add_to_cart: ["value", "currency"],
  begin_checkout: ["value", "currency"],
  add_payment_info: ["value", "currency"],
  add_shipping_info: ["value", "currency"],
  view_item: ["value", "currency"],
  view_item_list: [],
  select_item: [],
  view_cart: ["value", "currency"],
  refund: ["transaction_id"],
};

/**
 * GTM-14 — Analyze parameters sent by all GA4 Event tags
 */
export async function analyzeEventParameters(
  accountId: string,
  containerId: string,
  workspaceId: string
) {
  const ga4 = await getGa4Tags(accountId, containerId, workspaceId);
  const eventTags = ga4.tags.filter((t: any) => t.isEventTag);

  const analysis = [];

  for (const tag of eventTags) {
    const eventName = tag.eventName || "(missing eventName)";
    const params = (tag.parameter || [])
      .filter((p: any) => p.key && p.key !== "eventName" && p.key !== "measurementIdTrackingId")
      .map((p: any) => ({
        key: p.key,
        type: p.type,
        value: p.value ?? null,
      }));

    const paramKeys = params.map((p: any) => p.key);
    const critical = CRITICAL_PARAMS[eventName] || [];
    const missingCritical = critical.filter((k) => !paramKeys.includes(k));

    analysis.push({
      tagId: tag.tagId,
      tagName: tag.name,
      eventName,
      measurementIds: tag.measurementIds,
      parameters: params,
      parameterKeys: paramKeys,
      criticalParametersExpected: critical,
      missingCriticalParameters: missingCritical,
      hasAllCriticalParams: missingCritical.length === 0,
    });
  }

  const tagsWithMissingParams = analysis.filter((a) => a.missingCriticalParameters.length > 0);

  return {
    accountId,
    containerId,
    workspaceId,
    totalEventTags: eventTags.length,
    tagsWithMissingCriticalParams: tagsWithMissingParams.length,
    analysis,
    summary: {
      healthy: analysis.filter((a) => a.hasAllCriticalParams).length,
      needsAttention: tagsWithMissingParams.length,
    },
  };
}

/**
 * GTM-18 — Compare events configured in GTM vs events actually received in GA4
 */
export async function compareGtmVsGa4Events(params: {
  accountId: string;
  containerId: string;
  workspaceId: string;
  propertyId: string;
  startDate?: string;
  endDate?: string;
}) {
  const {
    accountId,
    containerId,
    workspaceId,
    propertyId,
    startDate = "30daysAgo",
    endDate = "yesterday",
  } = params;

  // 1. Events declared in GTM
  const ga4Tags = await getGa4Tags(accountId, containerId, workspaceId);
  const gtmEventNames = [
    ...new Set(
      ga4Tags.tags
        .filter((t: any) => t.isEventTag && t.eventName)
        .map((t: any) => t.eventName as string)
    ),
  ].sort();

  // 2. Events actually received in GA4
  let ga4EventNames: string[] = [];
  let ga4EventCounts: Record<string, number> = {};

  try {
    const report = await runReport({
      propertyId,
      metrics: ["eventCount"],
      dimensions: ["eventName"],
      startDate,
      endDate,
      limit: 200,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    });

    for (const row of report.rows || []) {
      const name = row.eventName;
      if (name) {
        ga4EventNames.push(name);
        ga4EventCounts[name] = parseInt(row.eventCount || "0", 10);
      }
    }
    ga4EventNames = [...new Set(ga4EventNames)].sort();
  } catch (err: any) {
    return {
      error: `Failed to fetch GA4 events: ${err.message}`,
      gtmEventNames,
      hint: "Check that the propertyId is correct and the Service Account has access to the GA4 property.",
    };
  }

  // 3. Compare
  const configuredInGtmButNotSeenInGa4 = gtmEventNames.filter(
    (e) => !ga4EventNames.includes(e)
  );

  const seenInGa4ButNotConfiguredInGtm = ga4EventNames.filter(
    (e) => !gtmEventNames.includes(e)
  );

  const matched = gtmEventNames.filter((e) => ga4EventNames.includes(e));

  // Enhanced measurement events (automatically collected by GA4)
  const enhancedMeasurementEvents = [
    "scroll",
    "outbound_click",
    "site_search",
    "video_start",
    "video_progress",
    "video_complete",
    "file_download",
    "page_view",
    "first_visit",
    "session_start",
    "user_engagement",
  ];

  const probablyEnhancedMeasurement = seenInGa4ButNotConfiguredInGtm.filter((e) =>
    enhancedMeasurementEvents.includes(e)
  );

  const trulyMissingInGtm = seenInGa4ButNotConfiguredInGtm.filter(
    (e) => !enhancedMeasurementEvents.includes(e)
  );

  return {
    period: { startDate, endDate },
    propertyId,
    gtm: {
      accountId,
      containerId,
      workspaceId,
      configuredEventNames: gtmEventNames,
      count: gtmEventNames.length,
    },
    ga4: {
      receivedEventNames: ga4EventNames,
      counts: ga4EventCounts,
      count: ga4EventNames.length,
    },
    comparison: {
      matched,
      configuredInGtmButNotSeenInGa4,
      seenInGa4ButNotConfiguredInGtm,
      probablyEnhancedMeasurement,
      trulyMissingInGtm,
    },
    insights: {
      matchRate:
        gtmEventNames.length > 0
          ? Math.round((matched.length / gtmEventNames.length) * 100)
          : 0,
      notes: [
        configuredInGtmButNotSeenInGa4.length > 0
          ? `${configuredInGtmButNotSeenInGa4.length} event(s) configured in GTM were never received in GA4 during the period. Possible causes: trigger not firing, wrong Measurement ID, or no traffic generating the event.`
          : null,
        trulyMissingInGtm.length > 0
          ? `${trulyMissingInGtm.length} event(s) appear in GA4 but have no corresponding GA4 Event tag in GTM (they may come from gtag.js directly, another container, or Measurement Protocol).`
          : null,
        probablyEnhancedMeasurement.length > 0
          ? `${probablyEnhancedMeasurement.length} event(s) are likely coming from GA4 Enhanced Measurement (no GTM tag needed).`
          : null,
      ].filter(Boolean),
    },
  };
}
