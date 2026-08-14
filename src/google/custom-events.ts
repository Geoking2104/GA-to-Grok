import { runReport } from "./data-api.js";
import { getGa4Tags } from "./tagmanager-api.js";

/** Standard + automatically collected + recommended events (not "custom") */
const KNOWN_EVENTS = new Set([
  // Automatically collected
  "first_visit",
  "session_start",
  "user_engagement",
  "page_view",
  "scroll",
  "click",
  "view_search_results",
  "file_download",
  "video_start",
  "video_progress",
  "video_complete",
  "form_start",
  "form_submit",
  // Recommended / ecommerce
  "login",
  "sign_up",
  "search",
  "share",
  "generate_lead",
  "view_item",
  "view_item_list",
  "select_item",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "refund",
  "add_to_wishlist",
  "select_promotion",
  "view_promotion",
  // Common enhanced
  "outbound_click",
  "site_search",
]);

/**
 * List events from GA4 and classify them as standard / recommended / custom.
 */
export async function listCustomEvents(params: {
  propertyId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const {
    propertyId,
    startDate = "30daysAgo",
    endDate = "yesterday",
    limit = 100,
  } = params;

  const report = await runReport({
    propertyId,
    metrics: ["eventCount", "activeUsers"],
    dimensions: ["eventName"],
    startDate,
    endDate,
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit,
  });

  const events = (report.rows || []).map((row: any) => {
    const name = row.eventName as string;
    const isKnown = KNOWN_EVENTS.has(name);
    return {
      eventName: name,
      eventCount: parseInt(row.eventCount || "0", 10),
      activeUsers: parseInt(row.activeUsers || "0", 10),
      category: isKnown ? "standard_or_recommended" : "custom",
    };
  });

  const custom = events.filter((e) => e.category === "custom");
  const standard = events.filter((e) => e.category === "standard_or_recommended");

  return {
    meta: { propertyId, period: { startDate, endDate } },
    summary: {
      totalEvents: events.length,
      customCount: custom.length,
      standardCount: standard.length,
    },
    customEvents: custom,
    standardEvents: standard,
  };
}

/**
 * Analyze a specific event: volume + custom parameters observed in GA4.
 * Uses event-scoped custom dimensions when available; falls back to event count breakdown.
 */
export async function analyzeCustomEvent(params: {
  propertyId: string;
  eventName: string;
  startDate?: string;
  endDate?: string;
}) {
  const {
    propertyId,
    eventName,
    startDate = "30daysAgo",
    endDate = "yesterday",
  } = params;

  // Volume
  const volumeReport = await runReport({
    propertyId,
    metrics: ["eventCount", "activeUsers", "eventCountPerUser"],
    dimensions: ["eventName"],
    startDate,
    endDate,
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: eventName },
      },
    },
    limit: 1,
  });

  const volume = volumeReport.rows?.[0] || {
    eventCount: "0",
    activeUsers: "0",
    eventCountPerUser: "0",
  };

  // Daily trend
  let daily: any[] = [];
  try {
    const dailyReport = await runReport({
      propertyId,
      metrics: ["eventCount"],
      dimensions: ["date"],
      startDate,
      endDate,
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: eventName },
        },
      },
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 90,
    });
    daily = (dailyReport.rows || []).map((r: any) => ({
      date: r.date,
      eventCount: parseInt(r.eventCount || "0", 10),
    }));
  } catch {
    // ignore
  }

  // Try to discover parameters via custom dimensions registered as event-scoped
  // We probe common parameter names by using them as dimensions if they exist.
  // Since we can't list event params directly via Data API easily, we return guidance.
  const isCustom = !KNOWN_EVENTS.has(eventName);

  return {
    meta: { propertyId, eventName, period: { startDate, endDate } },
    classification: isCustom ? "custom" : "standard_or_recommended",
    volume: {
      eventCount: parseInt(volume.eventCount || "0", 10),
      activeUsers: parseInt(volume.activeUsers || "0", 10),
      eventCountPerUser: parseFloat(volume.eventCountPerUser || "0"),
    },
    dailyTrend: daily,
    notes: [
      isCustom
        ? "Cet événement est personnalisé (non présent dans la liste standard/recommandée Google)."
        : "Cet événement fait partie des événements standard ou recommandés Google.",
      "Pour inspecter les paramètres custom enregistrés, configure-les comme dimensions personnalisées (scope event) dans GA4 Admin, puis relance une analyse.",
    ],
  };
}

/**
 * Suggest a ready-to-use GTM GA4 Event tag configuration for a custom event.
 * Optionally cross-checks if a tag already exists in a GTM workspace.
 */
export async function suggestCustomEventConfig(params: {
  eventName: string;
  parameters?: Array<{ key: string; value?: string; source?: string }>;
  measurementId?: string;
  // Optional GTM context to check if already configured
  accountId?: string;
  containerId?: string;
  workspaceId?: string;
}) {
  const {
    eventName,
    parameters = [],
    measurementId,
    accountId,
    containerId,
    workspaceId,
  } = params;

  // Validate event name (GA4 rules)
  const warnings: string[] = [];
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(eventName)) {
    warnings.push(
      "Le nom d'événement devrait commencer par une lettre et ne contenir que lettres, chiffres et underscores (max 40 caractères)."
    );
  }
  if (KNOWN_EVENTS.has(eventName)) {
    warnings.push(
      `"${eventName}" est un événement standard/recommandé Google — tu peux l'utiliser, mais ce n'est pas un événement purement custom.`
    );
  }
  if (eventName.length > 40) {
    warnings.push("Nom trop long (max 40 caractères pour GA4).");
  }

  // Suggested GTM tag structure
  const suggestedParameters = [
    { key: "eventName", type: "template", value: eventName },
    ...parameters.map((p) => ({
      key: p.key,
      type: "template",
      value: p.value || `{{${p.source || p.key}}}`,
      note: p.source
        ? `Variable GTM suggérée: {{${p.source}}}`
        : "Remplace par une variable Data Layer ou une constante",
    })),
  ];

  if (measurementId) {
    suggestedParameters.unshift({
      key: "measurementId",
      type: "template",
      value: measurementId,
      note: "Measurement ID de la property GA4 cible",
    });
  }

  // Check existing GTM tags if context provided
  let existingTags: any[] = [];
  if (accountId && containerId && workspaceId) {
    try {
      const ga4Tags = await getGa4Tags(accountId, containerId, workspaceId);
      existingTags = ga4Tags.tags.filter(
        (t: any) => t.isEventTag && t.eventName === eventName
      );
    } catch {
      // non-blocking
    }
  }

  const gtmConfigProposal = {
    tagName: `GA4 - ${eventName}`,
    tagType: "gaawe", // Google Analytics: GA4 Event
    eventName,
    measurementId: measurementId || "G-XXXXXXXX",
    parameters: suggestedParameters,
    recommendedTrigger: {
      type: "CUSTOM_EVENT",
      name: `CE - ${eventName}`,
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { key: "arg0", type: "template", value: "{{_event}}" },
            { key: "arg1", type: "template", value: eventName },
          ],
        },
      ],
      description:
        "Trigger Custom Event qui se déclenche quand dataLayer push event: '" +
        eventName +
        "'",
    },
    dataLayerExample: {
      event: eventName,
      ...Object.fromEntries(
        parameters.map((p) => [p.key, p.value || `<${p.key}_value>`])
      ),
    },
  };

  return {
    eventName,
    classification: KNOWN_EVENTS.has(eventName)
      ? "standard_or_recommended"
      : "custom",
    warnings,
    alreadyConfiguredInGtm: existingTags.length > 0,
    existingTags: existingTags.map((t: any) => ({
      tagId: t.tagId,
      tagName: t.name,
      measurementIds: t.measurementIds,
    })),
    gtmConfigProposal,
    implementationSteps: [
      "1. Dans GTM, créer un trigger de type Custom Event avec le nom d'événement exact",
      "2. Créer un tag de type 'Google Analytics: GA4 Event'",
      "3. Renseigner le Measurement ID (ou hériter du tag Configuration)",
      "4. Définir le Event Name et les paramètres (variables Data Layer recommandées)",
      "5. Lier le trigger au tag",
      "6. Prévisualiser (Preview) puis publier",
      "7. Vérifier dans GA4 → Admin → DebugView ou Realtime",
    ],
  };
}
