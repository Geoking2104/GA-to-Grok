import { runReport } from "./data-api.js";

/**
 * Analyze real ecommerce data from a GA4 property.
 * Provides funnel performance, revenue metrics, top items and basic data-quality signals.
 */
export async function analyzeEcommerceData(params: {
  propertyId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const {
    propertyId,
    startDate = "30daysAgo",
    endDate = "yesterday",
    limit = 20,
  } = params;

  // ─── 1. Core ecommerce metrics ──────────────────────────────
  const overview = await runReport({
    propertyId,
    metrics: [
      "ecommercePurchases",
      "purchaseRevenue",
      "averagePurchaseRevenue",
      "itemRevenue",
      "addToCarts",
      "checkouts",
      "itemViews",
      "sessions",
      "totalUsers",
    ],
    startDate,
    endDate,
    limit: 1,
  });

  const totals = overview.rows?.[0] || {};

  const purchases = num(totals.ecommercePurchases);
  const revenue = num(totals.purchaseRevenue);
  const aov = num(totals.averagePurchaseRevenue);
  const addToCarts = num(totals.addToCarts);
  const checkouts = num(totals.checkouts);
  const itemViews = num(totals.itemViews);
  const sessions = num(totals.sessions);

  // ─── 2. Funnel event counts ─────────────────────────────────
  const funnelEvents = [
    "view_item",
    "add_to_cart",
    "begin_checkout",
    "add_shipping_info",
    "add_payment_info",
    "purchase",
  ];

  const eventsReport = await runReport({
    propertyId,
    metrics: ["eventCount"],
    dimensions: ["eventName"],
    startDate,
    endDate,
    limit: 50,
  });

  const eventCounts: Record<string, number> = {};
  for (const row of eventsReport.rows || []) {
    eventCounts[row.eventName] = num(row.eventCount);
  }

  const funnel = funnelEvents.map((name, i) => {
    const count = eventCounts[name] || 0;
    const prevName = i > 0 ? funnelEvents[i - 1] : null;
    const prevCount = prevName ? eventCounts[prevName] || 0 : null;
    const stepConversion =
      prevCount && prevCount > 0 ? round((count / prevCount) * 100) : null;

    return {
      eventName: name,
      eventCount: count,
      stepConversionRate: stepConversion,
    };
  });

  // Overall funnel conversion (view_item → purchase)
  const viewItemCount = eventCounts["view_item"] || itemViews || 0;
  const purchaseCount = eventCounts["purchase"] || purchases || 0;
  const overallConversion =
    viewItemCount > 0 ? round((purchaseCount / viewItemCount) * 100) : null;

  // ─── 3. Top items ───────────────────────────────────────────
  let topItemsByRevenue: any[] = [];
  let topItemsByQuantity: any[] = [];

  try {
    const itemsRevenue = await runReport({
      propertyId,
      metrics: ["itemRevenue", "itemsPurchased", "itemsAddedToCart"],
      dimensions: ["itemName", "itemId"],
      startDate,
      endDate,
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit,
    });
    topItemsByRevenue = (itemsRevenue.rows || []).map((r: any) => ({
      itemName: r.itemName,
      itemId: r.itemId,
      itemRevenue: num(r.itemRevenue),
      itemsPurchased: num(r.itemsPurchased),
      itemsAddedToCart: num(r.itemsAddedToCart),
    }));

    const itemsQty = await runReport({
      propertyId,
      metrics: ["itemsPurchased", "itemRevenue"],
      dimensions: ["itemName", "itemId"],
      startDate,
      endDate,
      orderBys: [{ metric: { metricName: "itemsPurchased" }, desc: true }],
      limit,
    });
    topItemsByQuantity = (itemsQty.rows || []).map((r: any) => ({
      itemName: r.itemName,
      itemId: r.itemId,
      itemsPurchased: num(r.itemsPurchased),
      itemRevenue: num(r.itemRevenue),
    }));
  } catch {
    // item dimensions may not be available on all properties
  }

  // ─── 4. Data quality signals ────────────────────────────────
  const qualityIssues: string[] = [];
  const qualityChecks: any[] = [];

  // Purchases with zero revenue
  if (purchases > 0 && revenue === 0) {
    qualityIssues.push(
      `${purchases} purchase(s) enregistré(s) mais purchaseRevenue = 0 — le paramètre "value" est probablement manquant ou à 0`
    );
    qualityChecks.push({
      check: "zero_revenue_purchases",
      status: "fail",
      detail: "Purchases exist but revenue is 0",
    });
  } else if (purchases > 0 && revenue > 0) {
    qualityChecks.push({
      check: "zero_revenue_purchases",
      status: "pass",
      detail: "Revenue is present alongside purchases",
    });
  }

  // Add to cart without subsequent purchases (suspicious if very high ratio)
  if (addToCarts > 0 && purchases === 0) {
    qualityIssues.push(
      `${addToCarts} add_to_cart mais 0 purchase — vérifier le tracking de l'événement purchase`
    );
    qualityChecks.push({
      check: "cart_without_purchase",
      status: "warn",
      detail: "Add to carts exist but no purchases",
    });
  }

  // view_item vs itemViews consistency
  if (itemViews > 0 && (eventCounts["view_item"] || 0) === 0) {
    qualityIssues.push(
      "itemViews > 0 mais événement view_item absent — possible tracking via enhanced measurement ou autre mécanisme"
    );
  }

  // Very low AOV can indicate value sent in wrong unit (cents vs euros)
  if (purchases > 5 && aov > 0 && aov < 1) {
    qualityIssues.push(
      `AOV très bas (${aov}) — possible erreur d'unité (centimes envoyés comme euros ou inversement)`
    );
    qualityChecks.push({
      check: "suspicious_aov",
      status: "warn",
      detail: `AOV = ${aov}`,
    });
  }

  // ─── 5. Daily trend (optional, last period) ─────────────────
  let dailyTrend: any[] = [];
  try {
    const daily = await runReport({
      propertyId,
      metrics: ["ecommercePurchases", "purchaseRevenue"],
      dimensions: ["date"],
      startDate,
      endDate,
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 90,
    });
    dailyTrend = (daily.rows || []).map((r: any) => ({
      date: r.date,
      purchases: num(r.ecommercePurchases),
      revenue: num(r.purchaseRevenue),
    }));
  } catch {
    // ignore
  }

  // ─── Assemble ───────────────────────────────────────────────
  return {
    meta: {
      propertyId,
      period: { startDate, endDate },
      analyzedAt: new Date().toISOString(),
    },
    overview: {
      purchases,
      revenue: round(revenue, 2),
      averageOrderValue: round(aov, 2),
      addToCarts,
      checkouts,
      itemViews,
      sessions,
      purchaseRate:
        sessions > 0 ? round((purchases / sessions) * 100, 2) : null,
    },
    funnel: {
      steps: funnel,
      overallConversionRate: overallConversion,
      viewItemToPurchase: overallConversion,
    },
    topItems: {
      byRevenue: topItemsByRevenue,
      byQuantity: topItemsByQuantity,
    },
    dataQuality: {
      issues: qualityIssues,
      checks: qualityChecks,
      healthy: qualityIssues.length === 0,
    },
    dailyTrend,
    rawEventCounts: eventCounts,
  };
}

function num(v: any): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function round(v: number, decimals = 1): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}
