# Deployment Guide — GA-to-Grok

This document covers production deployment with Docker, Fly.io and Railway, including Redis caching.

## 1. Prerequisites

- Service Account JSON key with **Viewer** access on your GA4 properties
- (Recommended) A Redis instance for caching

## 2. Local with Docker Compose (easiest)

```bash
# Place your key next to docker-compose.yml
cp /path/to/your-service-account.json ./service-account.json

# Optional: set default property
export GA4_PROPERTY_ID=123456789

docker compose up -d --build
```

Server will be available at `http://localhost:3000`  
SSE endpoint: `http://localhost:3000/sse`

Redis is included automatically.

---

## 3. Fly.io (recommended for Grok)

### Install & login

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### Create the app

```bash
fly launch --name ga-to-grok --region cdg   # or your preferred region
# Answer "No" to the Postgres question
```

### Create a Redis instance (Upstash via Fly)

```bash
fly redis create
# Choose the same region and note the REDIS_URL
```

### Secrets

```bash
# Upload your service account as a secret file
fly secrets set GOOGLE_CREDENTIALS_JSON="$(cat service-account.json)"

# Or mount it as a file (alternative)
# fly secrets set GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json

fly secrets set REDIS_URL="redis://default:...@..."
fly secrets set GA4_PROPERTY_ID=123456789   # optional
```

### Deploy

```bash
fly deploy
```

Your public URL will look like:  
`https://ga-to-grok.fly.dev/sse`

Use this URL in Grok → Connectors → Custom.

### Useful commands

```bash
fly status
fly logs
fly scale count 1
```

---

## 4. Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `Geoking2104/GA-to-Grok` repository
3. Add a **Redis** plugin (Railway → + New → Database → Redis)
4. In the service variables:

```
GOOGLE_CREDENTIALS_JSON = {paste the full JSON}
REDIS_URL = ${{Redis.REDIS_URL}}
GA4_PROPERTY_ID = 123456789          # optional
TRANSPORT = http
PORT = 3000
```

5. Generate a public domain (Settings → Networking → Generate Domain)

Your SSE endpoint will be:  
`https://your-app.up.railway.app/sse`

---

## 5. Environment variables summary

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | ★ | Path to service-account.json |
| `GOOGLE_CREDENTIALS_JSON` | ★ | Alternative: full JSON content |
| `REDIS_URL` | Recommended | Redis connection string |
| `GA4_PROPERTY_ID` | Optional | Default property |
| `PORT` | Optional | Default 3000 |
| `CACHE_TTL_REPORT` | Optional | Seconds (default 600) |
| `CACHE_TTL_METADATA` | Optional | Seconds (default 3600) |

★ One of the two Google auth methods is required.

---

## 6. Connecting to Grok

1. Open [grok.com/connectors](https://grok.com/connectors)
2. **New Connector → Custom**
3. Paste: `https://your-public-url/sse`
4. Save and start chatting

Recommended first prompts:

- "List my GA4 properties"
- "Give me a traffic overview for the last 7 days"
- "What are the top pages this month?"
