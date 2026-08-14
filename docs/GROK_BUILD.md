# Package & use GA-to-Grok with Grok Build

[Grok Build](https://docs.x.ai/build/overview) loads MCP servers from:

- `~/.grok/config.toml` (user)
- **Project** `.grok/config.toml` (this repo ships one)
- Compatible `.mcp.json` / Cursor / Claude configs
- Plugins under `.grok/plugins/`

Tools appear as `ga-to-grok__<tool_name>`.

---

## Quick start (local stdio)

```bash
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install && npm run build

export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
# or: export GOOGLE_CREDENTIALS_JSON='{...}'
export GA4_PROPERTY_ID=123456789   # optional default

# Verify packaging
grok inspect
grok mcp doctor ga-to-grok

# Use in this repo
cd GA-to-Grok && grok
```

The committed [`.grok/config.toml`](../.grok/config.toml) registers the server automatically when you run `grok` inside the project (after `npm run build`).

### One-liner register (project scope)

```bash
grok mcp add --scope project ga-to-grok -- node dist/index.js --transport stdio
```

### User-level register (any directory)

```bash
grok mcp add ga-to-grok -- node /ABS/PATH/GA-to-Grok/dist/index.js --transport stdio
```

Or paste the example from [`examples/grok-build-user-config.toml`](../examples/grok-build-user-config.toml) into `~/.grok/config.toml`.

---

## Remote HTTP / SSE (Grok.com connectors & Grok Build)

1. Deploy the server with `TRANSPORT=http` (Docker / Fly / Railway).
2. Expose HTTPS, endpoint typically `/sse`.

### Grok Build CLI

```bash
grok mcp add --transport http ga-to-grok https://your-host.example.com/sse
# optional static auth:
#   --header "Authorization: Bearer ${GA_TO_GROK_TOKEN}"
```

### grok.com UI

1. [grok.com/connectors](https://grok.com/connectors) → **New Connector → Custom**
2. Paste `https://your-host.example.com/sse`
3. Save — tools are discovered automatically

---

## Compatibility files in this package

| File | Purpose |
|------|---------|
| `.grok/config.toml` | **Primary** Grok Build project MCP registration |
| `.mcp.json` | Claude Code / Cursor / Grok vendor MCP merge |
| `.grok/plugins/ga-to-grok/` | Plugin stub + `plugin.toml` |
| `examples/grok-build-user-config.toml` | Snippet for `~/.grok/config.toml` |

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GOOGLE_APPLICATION_CREDENTIALS` | one of | Path to SA JSON |
| `GOOGLE_CREDENTIALS_JSON` | one of | Inline SA JSON |
| `GA4_PROPERTY_ID` | no | Default property |
| `REDIS_URL` | no | Cache |
| `GA4_WRITE_ENABLED` | no | Default `false` in project config |
| `GTM_WRITE_ENABLED` | no | Default `false` in project config |

Grok expands `${VAR}` and `${VAR:-default}` in config at load time.

---

## TUI tips

- `/mcps` — list / toggle servers
- `r` — refresh after config change
- `grok mcp list` / `grok mcp doctor ga-to-grok`
- Logs: `~/.grok/logs/mcp/ga-to-grok.stderr.log`

Increase `startup_timeout_sec` if cold start is slow.

---

## Suggested prompts

- List my GA4 properties
- Audit GTM web container … for GA4
- Audit sGTM setup on account … container …
- Verify Measurement Protocol secrets for property …
- Run cutover checklist for web … vs server …
- Analyze ecommerce data last 30 days

---

## Safety

Project defaults disable writes (`GA4_WRITE_ENABLED=false`, `GTM_WRITE_ENABLED=false`).  
Phase 3 GTM writes and MP secret creation still require `confirm=true` when writes are enabled.
