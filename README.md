# GA-to-Grok

**Open-source MCP server** connecting **Google Analytics 4**, **Google Tag Manager** (web + **server-side**), and **Measurement Protocol** to **Grok** (xAI).

Grok can read GA4 data, audit GTM/sGTM setups, validate ecommerce events, configure Measurement Protocol secrets, run dual-tagging / cutover checklists, and more — via **MCP tools** or a **CLI**.

> Compatible with **Grok Connectors** (Custom MCP) and self-hosted deployments.  
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

## 3. Run the MCP server (for Grok)

### Local STDIO

```bash
npm run start:stdio
# or
node dist/index.js --transport stdio
```

### HTTP / SSE (remote connector)

```bash
npm run start:http
# Endpoint: http://localhost:3000/sse
```

### Docker

```bash
docker compose up -d
# see docs/DEPLOYMENT.md for Fly.io / Railway
```

### Connect in Grok

1. Deploy with a public HTTPS URL (or use a tunnel for dev)
2. [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
3. SSE URL: `https://your-server.com/sse`
4. Ask Grok, e.g. *“Audit my GA4 setup on GTM container …”*

Details: [docs/GROK_SETUP.md](docs/GROK_SETUP.md)

---

## 4. CLI — full validation workflow

Every major step has a CLI command (`ga-to-grok-cli` / `npm run cli -- …`).

```bash
npm run cli -- help
```

### Recommended implementation sequence

```bash
# 0. Discovery
npm run cli -- list-properties
npm run cli -- list-sgtm
npm run cli -- list-streams --property 123456789

# 1. Audit GTM Web
npm run cli -- audit-web \
  --account WEB_ACCOUNT_ID \
  --container WEB_CONTAINER_ID \
  --property 123456789

# 2. Audit sGTM
npm run cli -- audit-sgtm \
  --account SERVER_ACCOUNT_ID \
  --container SERVER_CONTAINER_ID

npm run cli -- audit-mp-client \
  --account SERVER_ACCOUNT_ID \
  --container SERVER_CONTAINER_ID

# 3. Measurement Protocol secrets & config
npm run cli -- verify-secrets --property 123456789
npm run cli -- suggest-mp \
  --property 123456789 \
  --mode both \
  --sgtm-url https://tags.example.com

# Create secret (preview then apply)
npm run cli -- create-mp-secret \
  --property 123456789 --stream STREAM_ID --name backend-prod --dry-run
npm run cli -- create-mp-secret \
  --property 123456789 --stream STREAM_ID --name backend-prod --confirm

# 4. Dual-tagging comparison (S3)
npm run cli -- compare-dual \
  --web-account WEB_ACCOUNT_ID --web-container WEB_CONTAINER_ID \
  --server-account SERVER_ACCOUNT_ID --server-container SERVER_CONTAINER_ID \
  --property 123456789

# 5. Cutover checklist (S4)
npm run cli -- cutover-checklist \
  --web-account WEB_ACCOUNT_ID --web-container WEB_CONTAINER_ID \
  --server-account SERVER_ACCOUNT_ID --server-container SERVER_CONTAINER_ID \
  --property 123456789 \
  --health-url https://tags.example.com/healthy

# 6. Health / observability (S5)
npm run cli -- health --url https://tags.example.com
npm run cli -- observability --url https://tags.example.com --property 123456789

# Bonus analytics
npm run cli -- analyze-ecommerce --property 123456789
npm run cli -- traffic --property 123456789 --start 7daysAgo
```

Full reference: [docs/CLI.md](docs/CLI.md)

### One-shot local CI-style validation

```bash
export GOOGLE_CREDENTIALS_JSON="$(cat sa.json)"
export GA4_PROPERTY_ID=123456789
export GTM_WEB_ACCOUNT_ID=...
export GTM_WEB_CONTAINER_ID=...
export GTM_SERVER_ACCOUNT_ID=...
export GTM_SERVER_CONTAINER_ID=...
export SGTM_HEALTH_URL=https://tags.example.com/healthy

npm run build
npm run validate:ci   # scripts/ci-validate.sh → reports/*.json
```

---

## 5. How to implement server-side tracking (with this repo)

1. **Stabilize web GA4/GTM** — `audit-web`, `validate_ecommerce_events` (via Grok or tools)
2. **Deploy sGTM** on a first-party host (`tags.example.com`) — Cloud Run / App Engine
3. **Audit server container** — `audit-sgtm` (GA4 client + GA4 tag + optional MP client)
4. **Configure MP** — `verify-secrets` → `suggest-mp` → optional `create-mp-secret`
5. **Compare parity** — `compare-dual` (web tags vs GA4 received events vs sGTM readiness)
6. **Gate cutover** — `cutover-checklist` until `readyForDualTagging` / `readyForCutover`
7. **Enable `server_container_url`** on web GA4 config (progressive traffic)
8. **Monitor** — `health` + `observability` + `analyze-ecommerce` for 48–72h
9. **Turn off client-side direct hits** once parity is proven

Architecture deep-dive: [docs/SERVER_SIDE_TRACKING_ARCHITECTURE.md](docs/SERVER_SIDE_TRACKING_ARCHITECTURE.md)

---

## 6. Main MCP tools (Grok)

### GA4

| Tool | Description |
|------|-------------|
| `list_properties` / `get_property_details` | Discovery |
| `get_traffic_overview` | Users, sessions, bounce rate… |
| `get_top_pages` / `get_acquisition` / `get_devices` | Breakdowns |
| `get_events_summary` / `run_report` / `run_realtime_report` | Events & flexible reports |
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

## 7. CI/CD

| Workflow | When | What |
|----------|------|------|
| **CI** | push / PR | typecheck + build + CLI smoke |
| **Validate** | manual (+ optional weekly cron) | live pipeline with SA secret |

Configure repository **secret** `GOOGLE_CREDENTIALS_JSON` and **variables** `GA4_PROPERTY_ID`, `GTM_WEB_*`, `GTM_SERVER_*`, `SGTM_HEALTH_URL`.

Details: [docs/CI_CD.md](docs/CI_CD.md)

---

## 8. Documentation index

| Doc | Content |
|-----|---------|
| [GROK_SETUP.md](docs/GROK_SETUP.md) | Connect MCP to Grok |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker / Fly / Railway |
| [CLI.md](docs/CLI.md) | All CLI commands |
| [CI_CD.md](docs/CI_CD.md) | GitHub Actions |
| [GTM_INTEGRATION.md](docs/GTM_INTEGRATION.md) | GTM ↔ GA4 specs |
| [PHASE3_WRITE.md](docs/PHASE3_WRITE.md) | Controlled GTM writes |
| [MEASUREMENT_PROTOCOL.md](docs/MEASUREMENT_PROTOCOL.md) | MP setup |
| [SERVER_SIDE_TRACKING_ARCHITECTURE.md](docs/SERVER_SIDE_TRACKING_ARCHITECTURE.md) | sGTM architecture |
| [CACHING.md](docs/CACHING.md) | Redis |

---

## 9. Project layout

```text
src/
  index.ts / server.ts / cli.ts
  auth/           Service Account + write gates
  google/         GA4, GTM, sGTM, MP, ecommerce, audits
  tools/          MCP tool registrations
  cache/          Optional Redis
scripts/ci-validate.sh
.github/workflows/ci.yml
.github/workflows/validate.yml
docs/
```

---

## License

Apache-2.0

---

Built for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / **KayrosLab**
