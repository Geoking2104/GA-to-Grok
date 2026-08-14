import {
  listCustomEvents,
  analyzeCustomEvent,
  suggestCustomEventConfig,
} from "../google/custom-events.js";

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

export const customEventTools = [
  {
    name: "list_custom_events",
    description:
      "List all events received in a GA4 property and classify them as standard/recommended vs custom. Useful to discover custom events already being collected.",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "GA4 Property ID" },
        startDate: { type: "string", description: "Default: 30daysAgo" },
        endDate: { type: "string", description: "Default: yesterday" },
        limit: { type: "number", description: "Max events to return (default 100)" },
      },
      required: ["propertyId"],
    },
    handler: async (args: any) => {
      try {
        return success(await listCustomEvents(args));
      } catch (err: any) {
        return error(err.message || "Failed to list custom events");
      }
    },
  },
  {
    name: "analyze_custom_event",
    description:
      "Analyze a specific event in GA4: volume, users, daily trend, and classification (custom vs standard).",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        eventName: { type: "string", description: "Exact event name to analyze" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["propertyId", "eventName"],
    },
    handler: async (args: any) => {
      try {
        return success(await analyzeCustomEvent(args));
      } catch (err: any) {
        return error(err.message || "Failed to analyze custom event");
      }
    },
  },
  {
    name: "suggest_custom_event_config",
    description:
      "Propose a ready-to-use GTM configuration for a custom GA4 event: tag type, parameters, trigger, dataLayer example, and implementation steps. Optionally checks if the event is already configured in a GTM workspace.",
    inputSchema: {
      type: "object",
      properties: {
        eventName: {
          type: "string",
          description: "Name of the custom event (e.g. newsletter_signup, video_played)",
        },
        parameters: {
          type: "array",
          description: "Optional list of parameters to include",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
              source: {
                type: "string",
                description: "Suggested GTM variable name",
              },
            },
          },
        },
        measurementId: {
          type: "string",
          description: "GA4 Measurement ID (G-XXXXXXXX)",
        },
        accountId: {
          type: "string",
          description: "Optional GTM Account ID — to check existing tags",
        },
        containerId: {
          type: "string",
          description: "Optional GTM Container ID",
        },
        workspaceId: {
          type: "string",
          description: "Optional GTM Workspace ID",
        },
      },
      required: ["eventName"],
    },
    handler: async (args: any) => {
      try {
        return success(await suggestCustomEventConfig(args));
      } catch (err: any) {
        return error(err.message || "Failed to suggest custom event config");
      }
    },
  },
];
