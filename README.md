# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** to **Grok** (xAI).

This connector allows Grok to query your GA4 properties directly through natural language.

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features

- ✅ Service Account authentication
- ✅ Core + Business tools (traffic, pages, acquisition, devices, events)
- ✅ **Robust multi-session SSE transport** (ready for Grok)
- ✅ Optional Redis caching (quota protection)
- ✅ Production-ready Docker + docker-compose
- ✅ Deployment guides for **Fly.io** and **Railway**
- 100% Open Source (**Apache-2.0**)

## Current Status (v0.4.0)

- [x] Complete project structure
- [x] Service Account authentication
- [x] Core + Business tools
- [x] Multi-session SSE transport
- [x] Redis caching
- [x] Docker + docker-compose + deployment docs
- [ ] Streamable HTTP (newer protocol)

## Quick Start for Grok

1. Create a Google Cloud Service Account → give it **Viewer** access on your GA4 properties
2. Deploy the server (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
3. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
4. Paste: `https://your-server.com/sse`
5. Start asking Grok

## Installation (local)

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install && npm run build
cp .env.example .env
# Edit .env

npm run start:http
```

### With Docker Compose (recommended for local testing)

```bash
# Place service-account.json in the project root
docker compose up -d --build
```

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
- [Deployment (Docker / Fly.io / Railway)](docs/DEPLOYMENT.md)
- [Redis Caching](docs/CACHING.md)

## License

Apache-2.0

---

Built with ❤️ for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / KayrosLab
