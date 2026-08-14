# GA-to-Grok

**Open-source Model Context Protocol (MCP) server** that connects **Google Analytics 4** to **Grok** (xAI).

This connector allows Grok to query your GA4 properties directly through natural language (traffic, sources, pages, events, realtime, etc.).

> Fully compatible with **Grok Connectors** (Custom MCP) and **Grok Build**.

## Features

- MCP Server with Streamable HTTP / SSE (required by Grok remote connectors)
- STDIO mode for local development (Cursor, Claude Desktop...)
- Service Account + OAuth 2.0 authentication ready
- Core tools: `list_properties`, `run_report`, `run_realtime_report`, `get_metadata`
- Pre-built business tools planned (traffic overview, top pages, acquisition...)
- Natural language date parsing
- Quota-aware design
- 100% Open Source (**Apache-2.0**)

## Current Status

- [x] Complete project structure
- [x] TypeScript skeleton + MCP server base
- [x] Tool registry with placeholder handlers
- [x] Docker support
- [x] Grok setup documentation
- [x] GitHub Actions CI
- [ ] Full Google Analytics Data API implementation
- [ ] Business tools
- [ ] Production Streamable HTTP transport

## Quick Start (Grok)

1. Deploy or run this server (see [docs/GROK_SETUP.md](docs/GROK_SETUP.md))
2. Go to [grok.com/connectors](https://grok.com/connectors)
3. Click **New Connector → Custom**
4. Paste your public MCP server URL
5. Start asking Grok about your analytics

## Installation

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install
npm run build
```

### Local (STDIO)

```bash
npm run start:stdio
```

### Remote (HTTP – for Grok)

```bash
npm run start:http
```

## Environment Variables

See [`.env.example`](.env.example)

## Project Structure

```
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── tools/
│   └── types/
├── docs/
│   └── GROK_SETUP.md
├── examples/
├── Dockerfile
└── ...
```

## Documentation

- [Grok Setup Guide](docs/GROK_SETUP.md)

## License

Apache-2.0

---

Built with ❤️ for the Grok ecosystem by [Geoking2104](https://github.com/Geoking2104) / KayrosLab
