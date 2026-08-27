# Connect GA-to-Grok to Grok

Source repo — https://github.com/Geoking2104/GA-to-Grok

Apache-2.0 · Node ≥ 20 · Service Account auth.

## Prerequisites

Google Cloud project with APIs enabled

- Google Analytics Data API
- Google Analytics Admin API
- Tag Manager API (if GTM / sGTM tools are needed)

Service Account JSON. Grant the SA email

- GA4 property — Viewer (Editor only if creating MP secrets)
- GTM accounts — Read (Edit only for Phase 3 tag/trigger creation)

Scopes used by the server

- analytics.readonly
- analytics.edit (MP secret creation)
- tagmanager.readonly
- tagmanager.edit.containers (Phase 3 writes)

Safety env (recommended in prod)

```
GA4_WRITE_ENABLED=false
GTM_WRITE_ENABLED=false
```

Auth env (pick one)

```
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/sa.json
# or
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

Optional default property

```
GA4_PROPERTY_ID=123456789
```

Transport

```
TRANSPORT=stdio   # local Grok Build
# or
TRANSPORT=http
PORT=3000
```

## Path A — grok.com Custom Connector (most users)

1. Deploy the server with `TRANSPORT=http` and public HTTPS (Docker / Fly / Railway / VPS). Endpoint is typically `/sse`.
2. Open https://grok.com/connectors → New Connector → Custom.
3. URL `https://your-host.example.com/sse`. Optional auth header.
4. Save. Tools auto-discover. In chat they appear with a connector prefix.

Quick local tunnel for tests

```
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install && npm run build
# set credentials in .env
npm run start:http
# then ngrok http 3000 → https://xxxx.ngrok-free.app/sse
```

Docker sketch

```
docker run -p 3000:3000 \
  -e TRANSPORT=http \
  -e GOOGLE_CREDENTIALS_JSON='...' \
  -e GA4_PROPERTY_ID=123456789 \
  ga-to-grok
```

Docs in the repo — `docs/GROK_SETUP.md`, `docs/DEPLOYMENT.md`, `docs/VPS_DEPLOY.md`.

## Path B — Grok Build (developers, stdio)

```
git clone https://github.com/Geoking2104/GA-to-Grok.git
cd GA-to-Grok
npm install && npm run build
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
grok mcp doctor ga-to-grok
cd GA-to-Grok && grok
```

The repo ships `.grok/config.toml` and `.mcp.json`. Tools appear as `ga-to-grok__<tool_name>`.

Register elsewhere

```
grok mcp add --scope project ga-to-grok -- node dist/index.js --transport stdio
grok mcp add --transport http ga-to-grok https://your-host.example.com/sse
```

Details — `docs/GROK_BUILD.md`.

## Path C — install this skill only

The MCP server must still be running and connected. Installing the skill without a connector gives playbooks but no live data.

From this repo

```
bash skill-installer/scripts/install-skill.sh --repo Geoking2104/GA-to-Grok --path skills/ga-to-grok
```

Or copy `skills/ga-to-grok/` into `/home/workdir/.grok/skills/ga-to-grok/` and start a new session.

## If tools are missing

1. `grok-mcp check` then `grok-mcp ls --query ga4`
2. Confirm SA can open the GA4 property in Google Admin (email invite).
3. Confirm APIs enabled and `TRANSPORT` matches how Grok is attached (stdio vs HTTP).
4. Do not invent traffic or revenue.
