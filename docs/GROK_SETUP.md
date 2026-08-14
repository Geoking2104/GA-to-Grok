# Connect GA-to-Grok to Grok

Two paths:

1. **Grok Build** (CLI / TUI) — local stdio or remote HTTP → see **[GROK_BUILD.md](GROK_BUILD.md)** (packaging)
2. **grok.com Connectors** — public HTTPS MCP (SSE / Streamable HTTP)

---

## A. Grok Build (recommended for developers)

```bash
cd GA-to-Grok && npm install && npm run build
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
grok mcp doctor ga-to-grok
grok   # run inside the repo — uses .grok/config.toml
```

Full packaging details: [GROK_BUILD.md](GROK_BUILD.md).

---

## B. grok.com Custom Connector (remote)

### Prerequisites

- Public **HTTPS** endpoint running this server (`TRANSPORT=http`)
- Service Account with access to GA4 (+ GTM if needed)

### 1. Credentials

1. Create a Service Account in Google Cloud
2. Enable Analytics Data API, Admin API, Tag Manager API
3. Grant **Viewer** (or Editor) on GA4 / GTM
4. Provide JSON via `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CREDENTIALS_JSON`

### 2. Run the server

**Local + tunnel**

```bash
npm install && npm run build
npm run start:http
ngrok http 3000
# use https://xxxx.ngrok-free.app/sse
```

**Production**

```bash
docker run -p 3000:3000 \
  -e TRANSPORT=http \
  -e GOOGLE_CREDENTIALS_JSON='...' \
  -e GA4_PROPERTY_ID=123456789 \
  ga-to-grok
```

See [DEPLOYMENT.md](DEPLOYMENT.md).

### 3. Add connector

1. [https://grok.com/connectors](https://grok.com/connectors)
2. **New Connector → Custom**
3. URL: `https://your-server.com/sse`
4. Optional auth headers
5. Save — tools auto-discover

### 4. Example prompts

- List my GA4 properties
- Traffic overview last 7 days
- Audit GA4 setup on GTM account X container Y
- Verify Measurement Protocol secrets
- Run sGTM cutover checklist

---

## Notes

- Grok **web** connectors need a **public** URL (no localhost without a tunnel).
- Prefer business tools (`get_traffic_overview`, `audit_ga4_setup_v2`, `cutover_checklist`, …).
- Keep the Service Account least-privilege unless you intentionally enable writes.
