# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** to **Grok** (xAI).

This connector allows Grok to query your GA4 properties directly through natural language (traffic, sources, pages, events, realtime, etc.).

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features

- ✅ **Service Account authentication** (GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON)
- ✅ **Core tools working**:
  - `list_properties` — discover accessible GA4 properties
  - `get_property_details`
  - `get_metadata` — dimensions & metrics (including custom)
  - `run_report` — flexible reporting with relative dates
  - `run_realtime_report` — last 30 minutes data
- MCP Server with STDIO (local) + HTTP mode skeleton
- Docker support
- 100% Open Source (**Apache-2.0**)

## Current Status

- [x] Complete project structure
- [x] TypeScript skeleton + MCP server base
- [x] **Service Account authentication**
- [x] **Core Google Analytics Data API + Admin API integration**
- [x] Working tools: `list_properties`, `run_report`, `run_realtime_report`, `get_metadata`
- [x] Docker + CI
- [ ] Business tools (traffic overview, top pages, acquisition...)
- [ ] Full production Streamable HTTP / SSE transport (required for remote Grok)
- [ ] Better quota management & caching

## Quick Start (Grok)

1. Create a Google Cloud Service Account with **Viewer** access on your GA4 properties
2. Deploy or run this server (see [docs/GROK_SETUP.md](docs/GROK_SETUP.md))
3. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
4. Paste your public MCP server URL
5. Start asking Grok about your analytics

## Installation

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install
npm run build
```

### Environment

```bash
cp .env.example .env
# Edit .env and set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# Optionally set GA4_PROPERTY_ID=123456789
```

### Local (STDIO)

```bash
npm run start:stdio
```

### Remote (HTTP – for Grok)

```bash
npm run start:http
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_properties` | List all accessible GA4 properties |
| `get_property_details` | Details of a specific property |
| `get_metadata` | Available dimensions & metrics |
| `run_report` | Flexible report (metrics + dimensions + date range) |
| `run_realtime_report` | Realtime data (last 30 min) |

## Documentation

- [Grok Setup Guide](docs/GROK_SETUP.md)

## License

Apache-2.0

---

Built with ❤️ for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / KayrosLab
