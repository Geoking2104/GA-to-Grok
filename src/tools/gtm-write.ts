import {
  createCustomEventTrigger,
  createGa4EventTag,
  createGa4EventSetup,
} from "../google/gtm-write.js";

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

export const gtmWriteTools = [
  {
    name: "create_custom_event_trigger",
    description:
      "Phase 3 WRITE: Create a Custom Event trigger in a GTM workspace. Requires confirm=true. Use dryRun=true to preview without writing. Does NOT publish.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        eventName: {
          type: "string",
          description: "Event name that will fire this trigger (dataLayer event)",
        },
        triggerName: {
          type: "string",
          description: "Optional custom trigger name (default: CE - {eventName})",
        },
        dryRun: {
          type: "boolean",
          description: "If true, only returns the payload that would be created",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to actually create (safety lock)",
        },
      },
      required: ["accountId", "containerId", "workspaceId", "eventName"],
    },
    handler: async (args: any) => {
      try {
        return success(await createCustomEventTrigger(args));
      } catch (err: any) {
        return error(err.message || "Failed to create trigger");
      }
    },
  },
  {
    name: "create_ga4_event_tag",
    description:
      "Phase 3 WRITE: Create a GA4 Event tag (gaawe) in a GTM workspace. Requires confirm=true. Use dryRun=true to preview. Does NOT publish.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        eventName: { type: "string" },
        tagName: { type: "string" },
        measurementId: {
          type: "string",
          description: "Optional G-XXXXXXXX override",
        },
        parameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Event parameters (key/value — value can be a GTM variable like {{dlv - price}})",
        },
        firingTriggerIds: {
          type: "array",
          items: { type: "string" },
          description: "Trigger IDs that should fire this tag",
        },
        dryRun: { type: "boolean" },
        confirm: { type: "boolean" },
      },
      required: ["accountId", "containerId", "workspaceId", "eventName"],
    },
    handler: async (args: any) => {
      try {
        return success(await createGa4EventTag(args));
      } catch (err: any) {
        return error(err.message || "Failed to create GA4 event tag");
      }
    },
  },
  {
    name: "create_ga4_event_setup",
    description:
      "Phase 3 WRITE (recommended): Create both a Custom Event trigger AND a linked GA4 Event tag in one call. Requires confirm=true. Use dryRun=true first. Does NOT publish the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        containerId: { type: "string" },
        workspaceId: { type: "string" },
        eventName: {
          type: "string",
          description: "Custom event name (e.g. newsletter_signup)",
        },
        measurementId: { type: "string" },
        parameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
          },
        },
        tagName: { type: "string" },
        triggerName: { type: "string" },
        dryRun: {
          type: "boolean",
          description: "Preview without writing",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to execute the creation",
        },
      },
      required: ["accountId", "containerId", "workspaceId", "eventName"],
    },
    handler: async (args: any) => {
      try {
        return success(await createGa4EventSetup(args));
      } catch (err: any) {
        return error(err.message || "Failed to create GA4 event setup");
      }
    },
  },
];
