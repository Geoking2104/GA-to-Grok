# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** to **Grok** (xAI).

This connector allows Grok to query your GA4 properties directly through natural language.

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features

- ✅ **Service Account authentication**
- ✅ **Core tools** + **Business tools** (traffic, pages, acquisition, devices, events)
- ✅ **HTTP + SSE transport** for Grok Custom Connector
- ✅ **Optional Redis caching** (quota protection + faster responses)
- ✅ Docker support
- 100% Open Source (**Apache-2.0**)

## Current Status (v0.3.0)

- [x] Complete project structure
- [x] Service Account authentication
- [x] Core + Business tools
- [x] SSE transport for remote Grok
- [x] **Redis caching** (optional, with smart TTLs)
- [ ] Better multi-session SSE handling
- [ ] Streamable HTTP (newer protocol)

## Quick Start for Grok

1. Create a Google Cloud Service Account → give it **Viewer** access on your GA4 properties
2. Run the server (see [docs/GROK_SETUP.md](docs/GROK_SETUP.md))
3. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
4. Paste: `https://your-server.com/sse`
5. Start asking Grok

## Installation

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install
npm run build
```

```bash
cp .env.example .env
# Set GOOGLE_APPLICATION_CREDENTIALS
# Optionally set REDIS_URL=redis://localhost:6379
```

```bash
npm run start:stdio   # local
npm run start:http    # for Grok
```

## Caching (Redis)

Caching is **optional**. Just set `REDIS_URL` to enable it.

| Data            | Default TTL |
|-----------------|-------------|
| Reports         | 10 minutes  |
| Metadata        | 1 hour      |
| Properties list | 30 minutes  |
| Realtime        | never       |

See [docs/CACHING.md](docs/CACHING.md) for full details.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_properties` | Discover accessible GA4 properties |
| `get_property_details` | Details of one property |
| `get_metadata` | Dimensions & metrics |
| `run_report` | Flexible custom report |
| `run_realtime_report` | Last 30 minutes |
| **`get_traffic_overview`** | **Recommended** – full overview |
| **`get_top_pages`** | Most viewed pages |
| **`get_acquisition`** | Channels / sources / medium |
| **`get_devices`** | Device / OS / browser |
| **`get_events_summary`** | Top events |

## Documentation

- [Grok Setup Guide](docs/GROK_SETUP.md)
- [Caching](docs/CACHING.md)

## License

Apache-2.0

---

Built with ❤️ for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / KayrosLab
