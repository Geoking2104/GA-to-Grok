# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** + **Google Tag Manager** to **Grok** (xAI).

This connector allows Grok to query your GA4 data **and** audit / understand your GTM setup that feeds GA4.

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features

- ✅ Service Account authentication (GA4 + GTM readonly)
- ✅ Core + Business GA4 tools (traffic, pages, acquisition, devices, events)
- ✅ **Google Tag Manager integration (Phase 1)**
  - List accounts / containers / workspaces / tags
  - Extract GA4 Configuration & Event tags
  - Intelligent `audit_ga4_setup` (score + warnings + recommendations)
- ✅ Robust multi-session SSE transport
- ✅ Optional Redis caching
- ✅ Production-ready Docker + deployment guides (Fly.io / Railway)
- 100% Open Source (**Apache-2.0**)

## Current Status (v0.5.0)

- [x] GA4 core + business tools
- [x] Multi-session SSE + Redis + Docker
- [x] **GTM Phase 1** (read-only + audit)
- [ ] GTM Phase 2 (triggers, variables, deeper audit)
- [ ] Streamable HTTP

## Quick Start for Grok

1. Create a Google Cloud Service Account with **Viewer** access on both GA4 properties **and** GTM accounts
2. Deploy the server (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
3. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
4. Paste: `https://your-server.com/sse`
5. Start asking Grok

## Available Tools

### Google Analytics 4

| Tool | Description |
|------|-------------|
| `list_properties` | Discover accessible GA4 properties |
| `get_traffic_overview` | **Recommended** – full overview |
| `get_top_pages` | Most viewed pages |
| `get_acquisition` | Channels / sources / medium |
| `get_devices` | Device / OS / browser |
| `get_events_summary` | Top events |
| `run_report` / `run_realtime_report` | Flexible + realtime |

### Google Tag Manager (Phase 1)

| Tool | Description |
|------|-------------|
| `list_gtm_accounts` | List GTM accounts |
| `list_gtm_containers` | List containers |
| `list_gtm_workspaces` | List workspaces |
| `list_gtm_tags` | List all tags |
| `get_ga4_tags` | Only GA4 Configuration + Event tags |
| `get_gtm_container_summary` | High-level GA4-focused summary |
| **`audit_ga4_setup`** | **Intelligent audit** (score, warnings, missing recommended events) |

## Documentation

- [Grok Setup Guide](docs/GROK_SETUP.md)
- [Deployment (Docker / Fly.io / Railway)](docs/DEPLOYMENT.md)
- [Redis Caching](docs/CACHING.md)
- [**GTM ↔ GA4 Integration Specs**](docs/GTM_INTEGRATION.md)

## License

Apache-2.0

---

Built with ❤️ for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / KayrosLab
