import { getGa4Tags } from "./tagmanager-api.js";
import { runReport } from "./data-api.js";

/**
 * Official GA4 ecommerce events and their required / recommended parameters.
 * Based on Google documentation:
 * https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */
const ECOMMERCE_SCHEMA: Record<
  string,
  {
    required: string[];
    recommended: string[];
    itemRequired?: string[];
    itemRecommended?: string[];
    description: string;
  }
> = {
  view_item_list: {
    description: "View a list of items",
    required: [],
    recommended: ["item_list_id", "item_list_name"],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["item_category", "price", "index"],
  },
  select_item: {
    description: "Select an item from a list",
    required: [],
    recommended: ["item_list_id", "item_list_name"],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["item_category", "price", "index"],
  },
  view_item: {
    description: "View item details",
    required: ["currency", "value"],
    recommended: [],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["item_category", "price", "quantity"],
  },
  add_to_cart: {
    description: "Add item(s) to cart",
    required: ["currency", "value"],
    recommended: [],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["item_category", "price", "quantity"],
  },
  remove_from_cart: {
    description: "Remove item(s) from cart",
    required: ["currency", "value"],
    recommended: [],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["price", "quantity"],
  },
  view_cart: {
    description: "View cart",
    required: ["currency", "value"],
    recommended: [],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["price", "quantity"],
  },
  begin_checkout: {
    description: "Begin checkout",
    required: ["currency", "value"],
    recommended: ["coupon"],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["price", "quantity"],
  },
  add_shipping_info: {
    description: "Add shipping information",
    required: ["currency", "value"],
    recommended: ["coupon", "shipping_tier"],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["price", "quantity"],
  },
  add_payment_info: {
    description: "Add payment information",
    required: ["currency", "value"],
    recommended: ["coupon", "payment_type"],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["price", "quantity"],
  },
  purchase: {
    description: "Purchase completed",
    required: ["currency", "value", "transaction_id"],
    recommended: ["coupon", "shipping", "tax"],
    itemRequired: ["item_id", "item_name"],
    itemRecommended: ["item_category", "price", "quantity"],
  },
  refund: {
    description: "Refund",
    required: ["transaction_id"],
    recommended: ["currency", "value"],
    itemRequired: [],
    itemRecommended: ["item_id", "quantity"],
  },
};

const CORE_FUNNEL = [
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "add_payment_info",
  "purchase",
];

function extractParamKeys(parameters: any[] = []): string[] {
  return parameters
    .filter((p) => p.key && !["eventName", "measurementIdTrackingId", "sendTo"].includes(p.key))
    .map((p) => p.key);
}

function hasItemsParam(parameters: any[] = []): boolean {
  return parameters.some(
    (p) =>
      p.key === "items" ||
      p.key === "item" ||
      (typeof p.value === "string" && p.value.toLowerCase().includes("items"))
  );
}

/**
 * Validate ecommerce events configured in GTM against the official GA4 schema.
 * Optionally cross-check with real GA4 data.
 */
export async function validateEcommerceEvents(params: {
  accountId: string;
  containerId: string;
  workspaceId: string;
  propertyId?: string;
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

  // 1. Get GA4 Event tags from GTM
  const ga4 = await getGa4Tags(accountId, containerId, workspaceId);
  const eventTags = ga4.tags.filter((t: any) => t.isEventTag);

  // Group by eventName
  const tagsByEvent: Record<string, any[]> = {};
  for (const tag of eventTags) {
    const name = tag.eventName || "(missing_event_name)";
    if (!tagsByEvent[name]) tagsByEvent[name] = [];
    tagsByEvent[name].push(tag);
  }

  const configuredEcommerceEvents = Object.keys(tagsByEvent).filter((e) =>
    ECOMMERCE_SCHEMA[e]
  );

  // 2. Validate each configured ecommerce event
  const eventValidations = [];

  for (const eventName of Object.keys(ECOMMERCE_SCHEMA)) {
    const schema = ECOMMERCE_SCHEMA[eventName];
    const tags = tagsByEvent[eventName] || [];
    const isConfigured = tags.length > 0;

    if (!isConfigured) {
      eventValidations.push({
        eventName,
        description: schema.description,
        status: CORE_FUNNEL.includes(eventName) ? "missing_core" : "missing_optional",
        configured: false,
        tagsCount: 0,
        issues: CORE_FUNNEL.includes(eventName)
          ? [`Événement funnel core "${eventName}" non configuré dans GTM`]
          : [],
        missingRequired: schema.required,
        missingRecommended: schema.recommended,
      });
      continue;
    }

    // Validate parameters on each tag
    const tagResults = tags.map((tag: any) => {
      const paramKeys = extractParamKeys(tag.parameter || []);
      const missingRequired = schema.required.filter((k) => !paramKeys.includes(k));
      const missingRecommended = schema.recommended.filter(
        (k) => !paramKeys.includes(k)
      );
      const hasItems = hasItemsParam(tag.parameter || []);
      const itemsIssue =
        schema.itemRequired && schema.itemRequired.length > 0 && !hasItems
          ? "Paramètre 'items' (array) absent ou non détecté"
          : null;

      const issues: string[] = [];
      if (missingRequired.length > 0) {
        issues.push(`Paramètres requis manquants: ${missingRequired.join(", ")}`);
      }
      if (itemsIssue) issues.push(itemsIssue);
      if (!tag.firingTriggerId || tag.firingTriggerId.length === 0) {
        issues.push("Aucun trigger de déclenchement");
      }

      return {
        tagId: tag.tagId,
        tagName: tag.name,
        measurementIds: tag.measurementIds,
        parameterKeys: paramKeys,
        missingRequired,
        missingRecommended,
        hasItemsArray: hasItems,
        hasTrigger: !!(tag.firingTriggerId && tag.firingTriggerId.length > 0),
        issues,
        isValid: issues.length === 0,
      };
    });

    const allValid = tagResults.every((t: any) => t.isValid);

    eventValidations.push({
      eventName,
      description: schema.description,
      status: allValid ? "valid" : "invalid",
      configured: true,
      tagsCount: tags.length,
      tags: tagResults,
      issues: tagResults.flatMap((t: any) => t.issues),
    });
  }

  // 3. Optional: real GA4 data
  let ga4Data: any = null;
  if (propertyId) {
    try {
      const report = await runReport({
        propertyId,
        metrics: ["eventCount", "purchaseRevenue"],
        dimensions: ["eventName"],
        startDate,
        endDate,
        limit: 100,
      });

      const counts: Record<string, { eventCount: number; purchaseRevenue: number }> = {};
      for (const row of report.rows || []) {
        counts[row.eventName] = {
          eventCount: parseInt(row.eventCount || "0", 10),
          purchaseRevenue: parseFloat(row.purchaseRevenue || "0"),
        };
      }

      ga4Data = {
        period: { startDate, endDate },
        propertyId,
        events: counts,
        purchaseCount: counts["purchase"]?.eventCount || 0,
        purchaseRevenue: counts["purchase"]?.purchaseRevenue || 0,
      };

      // Enrich validations with live data
      for (const v of eventValidations) {
        const live = counts[v.eventName];
        (v as any).ga4 = live
          ? { received: true, eventCount: live.eventCount, revenue: live.purchaseRevenue }
          : { received: false, eventCount: 0 };

        if (v.configured && !live) {
          v.issues.push(
            `Événement configuré dans GTM mais jamais reçu dans GA4 sur la période`
          );
          if (v.status === "valid") v.status = "configured_but_not_received";
        }
        if (!v.configured && live && live.eventCount > 0) {
          v.issues.push(
            `Événement reçu dans GA4 (${live.eventCount}×) mais non configuré comme tag GTM`
          );
          v.status = "received_but_not_configured";
        }
      }
    } catch (err: any) {
      ga4Data = { error: err.message };
    }
  }

  // 4. Scoring
  const coreEvents = eventValidations.filter((v) => CORE_FUNNEL.includes(v.eventName));
  const coreConfigured = coreEvents.filter((v) => v.configured).length;
  const coreValid = coreEvents.filter((v) => v.status === "valid").length;

  let score = 0;
  // 50 points for core funnel coverage
  score += (coreConfigured / CORE_FUNNEL.length) * 30;
  score += (coreValid / CORE_FUNNEL.length) * 40;
  // 20 points for purchase specifically being perfect
  const purchase = eventValidations.find((v) => v.eventName === "purchase");
  if (purchase?.status === "valid") score += 20;
  else if (purchase?.configured) score += 8;
  // 10 points bonus if live data matches
  if (ga4Data && !ga4Data.error && purchase?.configured) {
    if ((ga4Data.purchaseCount || 0) > 0) score += 10;
  }

  score = Math.round(Math.min(100, score));

  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";

  // Recommendations
  const recommendations: string[] = [];
  for (const v of eventValidations) {
    if (v.status === "missing_core") {
      recommendations.push(`Configurer l'événement funnel "${v.eventName}" (${v.description})`);
    }
    if (v.status === "invalid" || v.status === "configured_but_not_received") {
      for (const issue of v.issues.slice(0, 2)) {
        recommendations.push(`[${v.eventName}] ${issue}`);
      }
    }
  }

  return {
    meta: {
      accountId,
      containerId,
      workspaceId,
      propertyId: propertyId || null,
      auditedAt: new Date().toISOString(),
    },
    score,
    grade,
    funnel: {
      coreEvents: CORE_FUNNEL,
      coreConfigured,
      coreValid,
      coreTotal: CORE_FUNNEL.length,
    },
    events: eventValidations,
    ga4Data,
    recommendations: [...new Set(recommendations)].slice(0, 15),
    schemaReference: Object.fromEntries(
      Object.entries(ECOMMERCE_SCHEMA).map(([k, v]) => [
        k,
        {
          required: v.required,
          recommended: v.recommended,
          itemRequired: v.itemRequired,
          itemRecommended: v.itemRecommended,
        },
      ])
    ),
  };
}
