import {
  listDataStreams,
  listMeasurementProtocolSecrets,
  verifyGa4Secrets,
} from "../google/mp-secrets.js";
import {
  suggestMeasurementProtocolConfig,
  createMeasurementProtocolSecret,
  configureMeasurementProtocol,
} from "../google/mp-config.js";
import { success, fail } from "./response.js";
import { z } from "zod";
import { propertyId, strict } from "./schema.js";

export const mpSecretsTools = [
  {
    name: "list_data_streams",
    description:
      "List GA4 data streams for a property (web / Android / iOS), including Measurement IDs.",
    schema: strict({ propertyId }),
    handler: async (args: any) => {
      try {
        return success(await listDataStreams(args.propertyId));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "list_measurement_protocol_secrets",
    description:
      "List Measurement Protocol API secrets for a data stream. Values masked by default.",
    schema: strict({
      propertyId,
      dataStreamId: z.string(),
      revealSecrets: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await listMeasurementProtocolSecrets(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "verify_ga4_secrets",
    description:
      "Verify MP secrets across all streams of a GA4 property. Score, issues, readiness.",
    schema: strict({
      propertyId,
      revealSecrets: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await verifyGa4Secrets(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "suggest_measurement_protocol_config",
    description:
      "Generate a complete Measurement Protocol setup for a GA4 property: endpoints (direct + debug), payload examples, sGTM path, security notes and implementation steps. Uses real stream/secret status when available.",
    schema: strict({
      propertyId,
      dataStreamId: z.string().optional(),
      mode: z.string().optional(),
      sgtmBaseUrl: z.string().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await suggestMeasurementProtocolConfig(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "create_measurement_protocol_secret",
    description:
      "WRITE: Create a Measurement Protocol API secret on a GA4 data stream. Requires analytics.edit. Use dryRun=true to preview, confirm=true to execute. Returns secretValue once — store securely.",
    schema: strict({
      propertyId,
      dataStreamId: z.string(),
      displayName: z.string(),
      dryRun: z.boolean().optional(),
      confirm: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await createMeasurementProtocolSecret(args));
      } catch (err) { return fail(err); }
    },
  },
  {
    name: "configure_measurement_protocol",
    description:
      "End-to-end Measurement Protocol configuration helper: verifies secrets, suggests direct/sGTM setup, and optionally creates a secret (createSecretName + confirm).",
    schema: strict({
      propertyId,
      dataStreamId: z.string().optional(),
      mode: z.string().optional(),
      sgtmBaseUrl: z.string().optional(),
      createSecretName: z.string().optional(),
      dryRun: z.boolean().optional(),
      confirm: z.boolean().optional(),
    }),
    handler: async (args: any) => {
      try {
        return success(await configureMeasurementProtocol(args));
      } catch (err) { return fail(err); }
    },
  },
];
