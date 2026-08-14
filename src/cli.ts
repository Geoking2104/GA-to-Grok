#!/usr/bin/env node
/**
 * GA-to-Grok CLI — one command per workflow step
 *
 * Usage:
 *   npx ga-to-grok-cli <command> [options]
 *   npm run cli -- <command> [options]
 */

import { config } from "dotenv";
config();

import { initRedis } from "./cache/redis.js";

initRedis();

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [, , command, ...rest] = argv;
  const args: Args = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }

  return { command: command || "help", args };
}

function str(args: Args, key: string, fallback?: string): string | undefined {
  const v = args[key];
  if (v === undefined || v === true) return fallback;
  return String(v);
}

function req(args: Args, key: string): string {
  const v = str(args, key);
  if (!v) {
    throw new Error(`Missing required option --${key}`);
  }
  return v;
}

function bool(args: Args, key: string): boolean {
  return args[key] === true || args[key] === "true" || args[key] === "1";
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function help() {
  console.log(`
GA-to-Grok CLI — workflow commands

Usage:
  ga-to-grok-cli <command> [options]
  npm run cli -- <command> [options]

── Discovery ──────────────────────────────────────────
  list-properties
  list-sgtm
  list-streams              --property <id>
  list-clients              --account <id> --container <id> --workspace <id>

── Step 1 · Web audit ─────────────────────────────────
  audit-web                 --account <id> --container <id> [--workspace <id>] [--property <id>]

── Step 2 · sGTM audit ────────────────────────────────
  audit-sgtm                --account <id> --container <id> [--workspace <id>]
  audit-mp-client           --account <id> --container <id> [--workspace <id>] [--client <id>]

── Step 3 · Secrets & Measurement Protocol ────────────
  verify-secrets            --property <id> [--reveal]
  suggest-mp                --property <id> [--stream <id>] [--mode direct|sgtm|both] [--sgtm-url <url>]
  configure-mp              --property <id> [--stream <id>] [--mode ...] [--sgtm-url <url>]
                            [--create-secret <name>] [--dry-run] [--confirm]
  create-mp-secret          --property <id> --stream <id> --name <displayName> [--dry-run] [--confirm]

── Step 4 · Dual-tagging comparison (S3) ──────────────
  compare-dual
      --web-account <id> --web-container <id> [--web-workspace <id>]
      --server-account <id> --server-container <id> [--server-workspace <id>]
      --property <id> [--start <date>] [--end <date>]

── Step 5 · Cutover checklist (S4) ────────────────────
  cutover-checklist
      --web-account <id> --web-container <id>
      --server-account <id> --server-container <id>
      --property <id> [--health-url <url>] [--start <date>] [--end <date>]

── Step 6 · Health / observability (S5) ───────────────
  health                    --url <sgtm-base-or-health-url> [--timeout <ms>]
  observability             --url <sgtm-url> [--property <id>]

── Analytics ──────────────────────────────────────────
  analyze-ecommerce         --property <id> [--start <date>] [--end <date>]
  traffic                   --property <id> [--start <date>] [--end <date>]

── Server ─────────────────────────────────────────────
  serve-http                Start MCP HTTP/SSE server
  serve-stdio               Start MCP STDIO server

Examples:
  npm run cli -- audit-sgtm --account 123 --container 456
  npm run cli -- compare-dual --web-account 1 --web-container 2 --server-account 1 --server-container 9 --property 111
  npm run cli -- cutover-checklist --web-account 1 --web-container 2 --server-account 1 --server-container 9 --property 111 --health-url https://tags.example.com/healthy
  npm run cli -- health --url https://tags.example.com
`);
}

async function main() {
  const { command, args } = parseArgs(process.argv);

  try {
    switch (command) {
      case "help":
      case "--help":
      case "-h":
        help();
        break;

      // ── Discovery ───────────────────────────────────────────
      case "list-properties": {
        const { listProperties } = await import("./google/admin-api.js");
        print(await listProperties());
        break;
      }
      case "list-sgtm": {
        const { listSgtmContainers } = await import("./google/sgtm-api.js");
        print(await listSgtmContainers());
        break;
      }
      case "list-streams": {
        const { listDataStreams } = await import("./google/mp-secrets.js");
        print(await listDataStreams(req(args, "property")));
        break;
      }
      case "list-clients": {
        const { listGtmClients } = await import("./google/sgtm-api.js");
        print(
          await listGtmClients(
            req(args, "account"),
            req(args, "container"),
            req(args, "workspace")
          )
        );
        break;
      }

      // ── Step 1 Web audit ────────────────────────────────────
      case "audit-web": {
        const { auditGa4SetupV2 } = await import("./google/gtm-audit-v2.js");
        print(
          await auditGa4SetupV2({
            accountId: req(args, "account"),
            containerId: req(args, "container"),
            workspaceId: str(args, "workspace"),
            propertyId: str(args, "property"),
            startDate: str(args, "start"),
            endDate: str(args, "end"),
          })
        );
        break;
      }

      // ── Step 2 sGTM ─────────────────────────────────────────
      case "audit-sgtm": {
        const { auditSgtmSetup } = await import("./google/sgtm-api.js");
        print(
          await auditSgtmSetup({
            accountId: req(args, "account"),
            containerId: req(args, "container"),
            workspaceId: str(args, "workspace"),
          })
        );
        break;
      }
      case "audit-mp-client": {
        const { auditMeasurementProtocolClient } = await import(
          "./google/mp-client-audit.js"
        );
        print(
          await auditMeasurementProtocolClient({
            accountId: req(args, "account"),
            containerId: req(args, "container"),
            workspaceId: str(args, "workspace"),
            clientId: str(args, "client"),
          })
        );
        break;
      }

      // ── Step 3 Secrets / MP ─────────────────────────────────
      case "verify-secrets": {
        const { verifyGa4Secrets } = await import("./google/mp-secrets.js");
        print(
          await verifyGa4Secrets({
            propertyId: req(args, "property"),
            revealSecrets: bool(args, "reveal"),
          })
        );
        break;
      }
      case "suggest-mp": {
        const { suggestMeasurementProtocolConfig } = await import(
          "./google/mp-config.js"
        );
        print(
          await suggestMeasurementProtocolConfig({
            propertyId: req(args, "property"),
            dataStreamId: str(args, "stream"),
            mode: (str(args, "mode") as any) || "both",
            sgtmBaseUrl: str(args, "sgtm-url"),
          })
        );
        break;
      }
      case "configure-mp": {
        const { configureMeasurementProtocol } = await import(
          "./google/mp-config.js"
        );
        print(
          await configureMeasurementProtocol({
            propertyId: req(args, "property"),
            dataStreamId: str(args, "stream"),
            mode: (str(args, "mode") as any) || "both",
            sgtmBaseUrl: str(args, "sgtm-url"),
            createSecretName: str(args, "create-secret"),
            dryRun: bool(args, "dry-run"),
            confirm: bool(args, "confirm"),
          })
        );
        break;
      }
      case "create-mp-secret": {
        const { createMeasurementProtocolSecret } = await import(
          "./google/mp-config.js"
        );
        print(
          await createMeasurementProtocolSecret({
            propertyId: req(args, "property"),
            dataStreamId: req(args, "stream"),
            displayName: req(args, "name"),
            dryRun: bool(args, "dry-run"),
            confirm: bool(args, "confirm"),
          })
        );
        break;
      }

      // ── Step 4 Dual-tagging ─────────────────────────────────
      case "compare-dual": {
        const { compareDualTagging } = await import(
          "./google/sgtm-dual-tagging.js"
        );
        print(
          await compareDualTagging({
            webAccountId: req(args, "web-account"),
            webContainerId: req(args, "web-container"),
            webWorkspaceId: str(args, "web-workspace"),
            serverAccountId: req(args, "server-account"),
            serverContainerId: req(args, "server-container"),
            serverWorkspaceId: str(args, "server-workspace"),
            propertyId: req(args, "property"),
            startDate: str(args, "start"),
            endDate: str(args, "end"),
          })
        );
        break;
      }

      // ── Step 5 Cutover ──────────────────────────────────────
      case "cutover-checklist": {
        const { cutoverChecklist } = await import("./google/sgtm-cutover.js");
        print(
          await cutoverChecklist({
            webAccountId: req(args, "web-account"),
            webContainerId: req(args, "web-container"),
            webWorkspaceId: str(args, "web-workspace"),
            serverAccountId: req(args, "server-account"),
            serverContainerId: req(args, "server-container"),
            serverWorkspaceId: str(args, "server-workspace"),
            propertyId: req(args, "property"),
            sgtmHealthUrl: str(args, "health-url"),
            startDate: str(args, "start"),
            endDate: str(args, "end"),
          })
        );
        break;
      }

      // ── Step 6 Health ───────────────────────────────────────
      case "health": {
        const { checkSgtmHealth } = await import("./google/sgtm-health.js");
        print(
          await checkSgtmHealth({
            url: req(args, "url"),
            timeoutMs: str(args, "timeout")
              ? parseInt(String(str(args, "timeout")), 10)
              : undefined,
          })
        );
        break;
      }
      case "observability": {
        const { sgtmObservabilitySnapshot } = await import(
          "./google/sgtm-health.js"
        );
        print(
          await sgtmObservabilitySnapshot({
            sgtmHealthUrl: req(args, "url"),
            propertyId: str(args, "property"),
          })
        );
        break;
      }

      // ── Analytics ───────────────────────────────────────────
      case "analyze-ecommerce": {
        const { analyzeEcommerceData } = await import(
          "./google/ecommerce-data.js"
        );
        print(
          await analyzeEcommerceData({
            propertyId: req(args, "property"),
            startDate: str(args, "start"),
            endDate: str(args, "end"),
          })
        );
        break;
      }
      case "traffic": {
        const { getTrafficOverview } = await import("./tools/business.js");
        const result = await getTrafficOverview({
          propertyId: req(args, "property"),
          startDate: str(args, "start"),
          endDate: str(args, "end"),
        });
        // business tools return MCP content shape
        if (result?.content?.[0]?.text) {
          console.log(result.content[0].text);
        } else {
          print(result);
        }
        break;
      }

      // ── Server ──────────────────────────────────────────────
      case "serve-http": {
        const { startServer } = await import("./server.js");
        await startServer("http");
        break;
      }
      case "serve-stdio": {
        const { startServer } = await import("./server.js");
        await startServer("stdio");
        break;
      }

      default:
        console.error(`Unknown command: ${command}\n`);
        help();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message || err}`);
    process.exit(1);
  }
}

main();
