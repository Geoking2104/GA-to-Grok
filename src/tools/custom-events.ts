import {
  listCustomEvents,
  analyzeCustomEvent,
  suggestCustomEventConfig,
} from "../google/custom-events.js";
import { success, fail } from "./response.js";
import { z } from "zod";
import { accountId, containerId, workspaceId, propertyId, eventName, strict } from "./schema.js";

export const customEventTools = [
  {
    name: "list_custom_events",
    description:
      "List all events received in a GA4 property and classify them as standard/recommended vs custom. Useful to discover custom events already being collected.",
    schema: strict({
      propertyId,
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await listCustomEvents(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "analyze_custom_event",
    description:
      "Analyze a specific event in GA4: volume, users, daily trend, and classification (custom vs standard).",
    schema: strict({
      propertyId,
      eventName,
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await analyzeCustomEvent(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "suggest_custom_event_config",
    description:
      "Propose a ready-to-use GTM configuration for a custom GA4 event: tag type, parameters, trigger, dataLayer example, and implementation steps. Optionally checks if the event is already configured in a GTM workspace.",
    schema: strict({
      eventName,
      parameters: z
        .array(
          z.object({
            key: z.string(),
            value: z.string(),
            source: z.string().optional(),
          })
        )
        .optional(),
      measurementId: z.string().optional(),
      accountId: accountId.optional(),
      containerId: containerId.optional(),
      workspaceId: workspaceId.optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await suggestCustomEventConfig(args));
      } catch (err) { return fail(err); }
    },
  },
];
