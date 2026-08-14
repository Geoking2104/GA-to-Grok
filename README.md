# GA-to-Grok

**Open-source MCP server** connecting **Google Analytics 4**, **Google Tag Manager** (web + **server-side**), and **Measurement Protocol** to **Grok** (xAI).

Grok can read GA4 data, audit GTM/sGTM setups, validate ecommerce events, configure Measurement Protocol secrets, run dual-tagging / cutover checklists, and more — via **MCP tools** or a **CLI**.

> Compatible with **Grok Build**, **Grok Connectors** (Custom MCP), Claude Code / Cursor (`.mcp.json`), and self-hosted deployments.  
> **Apache-2.0** license · Node ≥ 20

---

## What you can do

| Domain | Capabilities |
|--------|----------------|
| **GA4** | Reports, realtime, traffic, acquisition, devices, events, ecommerce analysis |
| **GTM Web** | Tags, triggers, variables, GA4 audit v2, ecommerce schema validation |
| **sGTM** | List server containers, clients, MP client audit, dual-tagging, cutover, health |
| **Measurement Protocol** | List/verify secrets, suggest config, create secrets (write), direct + sGTM modes |
| **Custom events** | Discover, analyze, suggest GTM config; Phase 3 write (trigger + tag) |
| **Ops** | CLI per step, Redis cache, Docker, GitHub Actions CI + live validation |

---

## Architecture (high level)

```text
                    ┌─────────────────────┐
                    │   Grok / Agents     │
                    │  (MCP tools + CLI)  │
                    └──────────┬──────────┘
                               │ STDIO or HTTP/SSE
                               ▼
                    ┌─────────────────────┐
                    │    GA-to-Grok       │
                    │  Service Account    │
                    └──────────┬──────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
     GA4 Data/Admin      GTM Web API v2      GTM Server (sGTM)
     + MP secrets        tags/triggers       clients / health
```

Server-side collection path (product side):

```text
Browser → GTM Web (server_container_url) → sGTM (first-party)
                                              ├─ GA4 Client / MP Client
                                              └─ GA4 Tag → GA4 property
Backend ───────────────────────────────→ sGTM /mp/collect → GA4
```

---

## 1. Prerequisites

1. **Google Cloud project** with APIs enabled:
   - Google Analytics Data API
   - Google Analytics Admin API
   - Tag Manager API
2. **Service Account** JSON key
3. Grant the SA email:
   - GA4 property: **Viewer** (or Editor if you create MP secrets)
   - GTM accounts: **Read** (or **Edit** for Phase 3 tag creation)
4. Node.js **≥ 20**

### Scopes used

```text
analytics.readonly
analytics.edit                    # MP secret creation
tagmanager.readonly
tagmanager.edit.containers        # Phase 3 GTM writes
```

Writes are gated by `confirm=true`, optional `dryRun`, and:

```bash
GA4_WRITE_ENABLED=false   # blocks secret creation
GTM_WRITE_ENABLED=false   # blocks GTM tag/trigger creation
```

---

## 2. Install & configure

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install
cp .env.example .env
```

Edit `.env`:

```bash
# Auth (pick one)
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/sa.json
# or
GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'

# Optional defaults
GA4_PROPERTY_ID=123456789

# Transport
TRANSPORT=stdio          # or http
PORT=3000

# Optional Redis
REDIS_URL=redis://localhost:6379

# Safety (recommended in prod / CI)
GA4_WRITE_ENABLED=false
GTM_WRITE_ENABLED=false
```

Build:

```bash
npm run build
```

---

## 3. Grok Build packaging (ready out of the box)

This repo ships Grok Build–ready files:

| File | Role |
|------|------|
| `.grok/config.toml` | Project-scoped MCP server (`ga-to-grok`) |
| `.mcp.json` | Claude Code / Cursor / Grok compatibility |
| `.grok/plugins/ga-to-grok/` | Plugin stub |
| `docs/GROK_BUILD.md` | Full packaging guide |

### Local (stdio) in this repo

```bash
npm run build
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

grok mcp doctor ga-to-grok
cd /path/to/GA-to-Grok && grok
```

Or register explicitly:

```bash
grok mcp add --scope project ga-to-grok -- node dist/index.js --transport stdio
```

### Remote HTTP / SSE

```bash
grok mcp add --transport http ga-to-grok https://your-host.example.com/sse
```

### grok.com Connectors

1. Deploy with `TRANSPORT=http` + public HTTPS
2. [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
3. URL: `https://your-server.com/sse`

Details: **[docs/GROK_BUILD.md](docs/GROK_BUILD.md)** · [docs/GROK_SETUP.md](docs/GROK_SETUP.md)

---

## 4. Run the MCP server

### Local STDIO

```bash
npm run start:stdio
# or
node dist/index.js --transport stdio
```

### HTTP / SSE

```bash
npm run start:http
# Endpoint: http://localhost:3000/sse
```

### Docker

```bash
docker compose up -d
# see docs/DEPLOYMENT.md for Fly.io / Railway
```

---

## 5. CLI — full validation workflow

```bash
npm run cli -- help
```

### Recommended sequence

```bash
npm run cli -- list-properties
npm run cli -- list-sgtm
npm run cli -- audit-web --account WEB_ACCOUNT_ID --container WEB_CONTAINER_ID --property 123456789
npm run cli -- audit-sgtm --account SERVER_ACCOUNT_ID --container SERVER_CONTAINER_ID
npm run cli -- verify-secrets --property 123456789
npm run cli -- suggest-mp --property 123456789 --mode both --sgtm-url https://tags.example.com
npm run cli -- compare-dual \
  --web-account WEB_ACCOUNT_ID --web-container WEB_CONTAINER_ID \
  --server-account SERVER_ACCOUNT_ID --server-container SERVER_CONTAINER_ID \
  --property 123456789
npm run cli -- cutover-checklist \
  --web-account WEB_ACCOUNT_ID --web-container WEB_CONTAINER_ID \
  --server-account SERVER_ACCOUNT_ID --server-container SERVER_CONTAINER_ID \
  --property 123456789 --health-url https://tags.example.com/healthy
npm run cli -- health --url https://tags.example.com
```

Full reference: [docs/CLI.md](docs/CLI.md)

```bash
npm run validate:ci   # scripts/ci-validate.sh
```

---

## 6. How to implement server-side tracking

1. Stabilize web GA4/GTM — `audit-web`, `validate_ecommerce_events`
2. Deploy sGTM first-party (`tags.example.com`)
3. `audit-sgtm` (GA4 client + tag + optional MP client)
4. `verify-secrets` → `suggest-mp` → optional `create-mp-secret`
5. `compare-dual`
6. `cutover-checklist` until `readyForDualTagging` / `readyForCutover`
7. Enable `server_container_url` progressively
8. Monitor with `health` + `observability` + `analyze-ecommerce` (48–72h)
9. Turn off client-side direct hits once parity is proven

→ [docs/SERVER_SIDE_TRACKING_ARCHITECTURE.md](docs/SERVER_SIDE_TRACKING_ARCHITECTURE.md)

---

## 7. Main MCP tools

### GA4

| Tool | Description |
|------|-------------|
| `list_properties` / `get_property_details` | Discovery |
| `get_traffic_overview` | Users, sessions, bounce rate… |
| `get_top_pages` / `get_acquisition` / `get_devices` | Breakdowns |
| `get_events_summary` / `run_report` / `run_realtime_report` | Events & reports |
| `analyze_ecommerce_data` | Funnel, revenue, AOV, data quality |

### GTM Web

| Tool | Description |
|------|-------------|
| `list_gtm_*` / `get_ga4_tags` / `get_tag_details` | Inventory |
| `audit_ga4_setup_v2` | Full audit + optional live GA4 |
| `validate_ecommerce_events` | Official ecommerce schema |
| `compare_gtm_vs_ga4_events` | Config vs received |
| `create_ga4_event_setup` | Phase 3 write (confirm required) |

### sGTM & MP

| Tool | Description |
|------|-------------|
| `list_sgtm_containers` / `list_gtm_clients` | Server inventory |
| `audit_sgtm_setup` / `audit_measurement_protocol_client` | Server audits |
| `verify_ga4_secrets` / `configure_measurement_protocol` | Secrets & setup |
| `compare_dual_tagging` | S3 parity |
| `cutover_checklist` | S4 readiness flags |
| `check_sgtm_health` / `sgtm_observability_snapshot` | S5 ops |

---

## 8. CI/CD

| Workflow | When | What |
|----------|------|------|
| **CI** | push / PR | typecheck + build + CLI smoke |
| **Validate** | manual (+ optional weekly cron) | live pipeline with SA secret |

→ [docs/CI_CD.md](docs/CI_CD.md)

---

## 9. Documentation index

| Doc | Content |
|-----|---------|
| **[GROK_BUILD.md](docs/GROK_BUILD.md)** | **Grok Build packaging & install** |
| [GROK_SETUP.md](docs/GROK_SETUP.md) | Connectors + Build overview |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker / Fly / Railway |
| [CLI.md](docs/CLI.md) | All CLI commands |
| [CI_CD.md](docs/CI_CD.md) | GitHub Actions |
| [GTM_INTEGRATION.md](docs/GTM_INTEGRATION.md) | GTM ↔ GA4 specs |
| [PHASE3_WRITE.md](docs/PHASE3_WRITE.md) | Controlled GTM writes |
| [MEASUREMENT_PROTOCOL.md](docs/MEASUREMENT_PROTOCOL.md) | MP setup |
| [SERVER_SIDE_TRACKING_ARCHITECTURE.md](docs/SERVER_SIDE_TRACKING_ARCHITECTURE.md) | sGTM architecture |
| [CACHING.md](docs/CACHING.md) | Redis |

---

## 10. Project layout

```text
.grok/config.toml          # Grok Build project MCP
.mcp.json                  # Vendor-compatible MCP map
.grok/plugins/ga-to-grok/  # Plugin stub
src/
  index.ts / server.ts / cli.ts
  auth/ google/ tools/ cache/
scripts/ci-validate.sh
.github/workflows/
docs/
```

---

## License

Apache-2.0

---

Built for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / **KayrosLab**
