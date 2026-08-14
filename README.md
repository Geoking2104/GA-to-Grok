# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** to **Grok** (xAI).

This connector allows Grok to query your GA4 properties directly through natural language (traffic, sources, pages, events, realtime, etc.).

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features (planned / in progress)

- MCP Server with Streamable HTTP / SSE (required by Grok remote connectors)
- STDIO mode for local development
- Service Account + OAuth 2.0 authentication
- Core reporting (`run_report`) + Realtime
- Metadata discovery
- Pre-built business tools (traffic overview, top pages, acquisition...)
- Natural language date parsing
- Quota-aware
- 100% Open Source (Apache-2.0)

## Quick Start for Grok

See [docs/GROK_SETUP.md](docs/GROK_SETUP.md) (coming in next commit).

## Status

- [x] Repository initialized
- [ ] Full project structure
- [ ] Core MCP tools
- [ ] Business tools
- [ ] Production Docker image

## License

Apache-2.0

---

Built for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104)
