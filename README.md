# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** to **Grok** (xAI).

This connector allows Grok to query your GA4 properties directly through natural language.

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features

- ✅ **Service Account authentication**
- ✅ **Core tools**: `list_properties`, `run_report`, `run_realtime_report`, `get_metadata`
- ✅ **Business tools** (optimized for Grok):
  - `get_traffic_overview`
  - `get_top_pages`
  - `get_acquisition`
  - `get_devices`
  - `get_events_summary`
- ✅ **HTTP + SSE transport** ready for Grok Custom Connector
- ✅ Docker support
- 100% Open Source (**Apache-2.0**)

## Current Status (v0.2.0)

- [x] Complete project structure
- [x] Service Account authentication
- [x] Core Google Analytics Data API + Admin API
- [x] Business tools
- [x] SSE transport for remote Grok
- [ ] Better multi-session SSE handling
- [ ] Quota management & caching
- [ ] Streamable HTTP (newer protocol)

## Quick Start for Grok

1. Create a Google Cloud Service Account → give it **Viewer** access on your GA4 properties
2. Run the server (see [docs/GROK_SETUP.md](docs/GROK_SETUP.md))
3. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
4. Paste: `https://your-server.com/sse`
5. Start asking Grok:

   - "Give me a traffic overview for the last 7 days"
   - "What are the top pages this month?"
   - "Show acquisition by channel"

## Installation

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install
npm run build
```

```bash
cp .env.example .env
# Set GOOGLE_APPLICATION_CREDENTIALS and optionally GA4_PROPERTY_ID
```

```bash
# Local
npm run start:stdio

# For Grok (remote)
npm run start:http
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

## License

Apache-2.0

---

Built with ❤️ for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / KayrosLab
