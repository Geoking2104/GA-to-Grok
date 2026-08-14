# How to connect GA-to-Grok to Grok (Custom MCP)

This guide explains how to make this MCP server available inside Grok conversations.

## Prerequisites

- A public HTTPS endpoint running this server (or a tunnel)
- A Google Cloud project with **Google Analytics Data API** and **Google Analytics Admin API** enabled
- A Service Account with Viewer access on the target GA4 properties

## 1. Prepare credentials

1. Create a Service Account in Google Cloud Console
2. Download the JSON key
3. In GA4 Admin → Property Access Management, add the service account email as **Viewer**
4. Place the JSON file on the server (or use environment variable)

## 2. Run the server

### Option A – Local + ngrok (quick test)

```bash
npm install
npm run build
npm run start:stdio   # or start:http when fully implemented

# In another terminal
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL.

### Option B – Production (recommended)

Deploy the Docker image on Fly.io, Railway, Render, Cloudflare Workers, or any VPS.

```bash
docker build -t ga-to-grok .
docker run -p 3000:3000 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json \
  -v $(pwd)/service-account.json:/secrets/sa.json \
  ga-to-grok
```

## 3. Add the connector in Grok

1. Go to [https://grok.com/connectors](https://grok.com/connectors)
2. Click **New Connector**
3. Select **Custom**
4. Paste your public MCP server URL
5. (Optional) Add authentication headers if you protected the endpoint
6. Save

Grok will discover the available tools automatically.

## 4. Test

In a Grok conversation, try:

- "List my GA4 properties"
- "Show me traffic for the last 7 days on property 123456789"
- "What are the top pages this month?"

## Notes

- The server must be reachable from the public internet (Grok does not support localhost).
- Prefer Streamable HTTP transport when available.
- Keep the Service Account least-privilege (Viewer only).

---

Need help? Open an issue on the repository.
