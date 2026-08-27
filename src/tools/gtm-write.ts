import {
  createCustomEventTrigger,
  createGa4EventTag,
  createGa4EventSetup,
} from "../google/gtm-write.js";
import { success, fail } from "./response.js";
import { z } from "zod";
import { accountId, containerId, workspaceId, eventName, strict } from "./schema.js";

const paramItem = z.object({ key: z.string(), value: z.string() });

export const gtmWriteTools = [
  {
    name: "create_custom_event_trigger",
    description:
      "Phase 3 WRITE: Create a Custom Event trigger in a GTM workspace. Requires confirm=true. Use dryRun=true to preview without writing. Does NOT publish.",
    schema: strict({
      accountId, containerId, workspaceId, eventName,
      triggerName: z.string().optional(),
      dryRun: z.boolean().optional(),
      confirm: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await createCustomEventTrigger(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "create_ga4_event_tag",
    description:
      "Phase 3 WRITE: Create a GA4 Event tag (gaawe) in a GTM workspace. Requires confirm=true. Use dryRun=true to preview. Does NOT publish.",
    schema: strict({
      accountId, containerId, workspaceId, eventName,
      tagName: z.string().optional(),
      measurementId: z.string().optional(),
      parameters: z.array(paramItem).optional(),
      firingTriggerIds: z.array(z.string()).optional(),
      dryRun: z.boolean().optional(),
      confirm: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await createGa4EventTag(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "create_ga4_event_setup",
    description:
      "Phase 3 WRITE (recommended): Create both a Custom Event trigger AND a linked GA4 Event tag in one call. Requires confirm=true. Use dryRun=true first. Does NOT publish the workspace.",
    schema: strict({
      accountId, containerId, workspaceId, eventName,
      measurementId: z.string().optional(),
      parameters: z.array(paramItem).optional(),
      tagName: z.string().optional(),
      triggerName: z.string().optional(),
      dryRun: z.boolean().optional(),
      confirm: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await createGa4EventSetup(args));
      } catch (err) { return fail(err); }
    },
  },
];
