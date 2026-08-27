import {
  listSgtmContainers,
  listGtmClients,
  getGtmClientDetails,
  auditSgtmSetup,
} from "../google/sgtm-api.js";
import { auditMeasurementProtocolClient } from "../google/mp-client-audit.js";
import { compareDualTagging } from "../google/sgtm-dual-tagging.js";
import { cutoverChecklist } from "../google/sgtm-cutover.js";
import {
  checkSgtmHealth,
  sgtmObservabilitySnapshot,
} from "../google/sgtm-health.js";
import { success, fail } from "./response.js";
import { z } from "zod";
import { accountId, containerId, workspaceId, propertyId, url, strict } from "./schema.js";

export const sgtmTools = [
  {
    name: "list_sgtm_containers",
    description: "List server-side GTM containers (usageContext SERVER).",
    schema: strict({}),
    handler: async () => {
      try {
        return success(await listSgtmContainers());
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "list_gtm_clients",
    description: "List clients in a GTM workspace (sGTM entry points).",
    schema: strict({ accountId, containerId, workspaceId }),
    handler: async (args: any) => {
      try {
        return success(
          await listGtmClients(args.accountId, args.containerId, args.workspaceId)
        );
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "get_gtm_client_details",
    description: "Get full details of a GTM client.",
    schema: strict({ accountId, containerId, workspaceId, clientId: z.string() }),
    handler: async (args: any) => {
      try {
        return success(
          await getGtmClientDetails(
            args.accountId,
            args.containerId,
            args.workspaceId,
            args.clientId
          )
        );
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "audit_sgtm_setup",
    description: "Audit server-side GTM container for GA4 readiness.",
    schema: strict({ accountId, containerId, workspaceId: workspaceId.optional() }),
    handler: async (args: any) => {
      try {
        return success(await auditSgtmSetup(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "audit_measurement_protocol_client",
    description: "Deep technical audit of Measurement Protocol client(s) in sGTM.",
    schema: strict({
      accountId, containerId,
      workspaceId: workspaceId.optional(),
      clientId: z.string().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await auditMeasurementProtocolClient(args));
      } catch (err) { return fail(err); }
    },
  },

  // ─── S3 Dual-tagging ────────────────────────────────────────
  {
    name: "compare_dual_tagging",
    description:
      "S3: Compare web GTM vs sGTM vs events actually received in GA4. Returns match rates, missing events, server readiness signals and migration risks.",
    schema: strict({
      webAccountId: accountId,
      webContainerId: containerId,
      webWorkspaceId: workspaceId.optional(),
      serverAccountId: accountId,
      serverContainerId: containerId,
      serverWorkspaceId: workspaceId.optional(),
      propertyId,
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await compareDualTagging(args));
      } catch (err) { return fail(err); }
    },
  },

  // ─── S4 Cutover checklist ───────────────────────────────────
  {
    name: "cutover_checklist",
    description:
      "S4: Automated readiness checklist for sGTM dual-tagging / cutover. Combines web audit, sGTM audit, MP secrets, parity, ecommerce quality and optional /healthy probe. Returns readyForDualTagging / readyForCutover flags.",
    schema: strict({
      webAccountId: accountId,
      webContainerId: containerId,
      webWorkspaceId: workspaceId.optional(),
      serverAccountId: accountId,
      serverContainerId: containerId,
      serverWorkspaceId: workspaceId.optional(),
      propertyId,
      sgtmHealthUrl: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await cutoverChecklist(args));
      } catch (err) { return fail(err); }
    },
  },

  // ─── S5 Health / observability ──────────────────────────────
  {
    name: "check_sgtm_health",
    description:
      "S5: Probe sGTM health endpoints (/healthy, /healthz, /) and report status codes + latency.",
    schema: strict({
      url,
      paths: z.array(z.string()).optional(),
      timeoutMs: z.number().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await checkSgtmHealth(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "sgtm_observability_snapshot",
    description:
      "S5: Combined snapshot — sGTM health probe + optional GA4 realtime event activity.",
    schema: strict({
      sgtmHealthUrl: url,
      propertyId: propertyId.optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await sgtmObservabilitySnapshot(args));
      } catch (err) { return fail(err); }
    },
  },
];
