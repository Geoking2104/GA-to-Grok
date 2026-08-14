# How to connect GA-to-Grok to Grok (Custom MCP)

This guide explains how to make this MCP server available inside Grok conversations.

## Prerequisites

- A public HTTPS endpoint running this server
- A Google Cloud project with **Google Analytics Data API** and **Google Analytics Admin API** enabled
- A Service Account with **Viewer** access on the target GA4 properties

## 1. Prepare credentials

1. Create a Service Account in Google Cloud Console
2. Download the JSON key
3. In GA4 Admin → Property Access Management, add the service account email as **Viewer**
4. Place the JSON file on the server (or inject via environment variable)

## 2. Run the server

### Option A – Local + ngrok (quick test)

```bash
npm install
npm run build
npm run start:http

# In another terminal
ngrok http 3000
```

Copy the HTTPS URL given by ngrok (e.g. `https://xxxx.ngrok-free.app`).

### Option B – Production (recommended)

Deploy with Docker on Fly.io, Railway, Render, or any VPS:

```bash
docker build -t ga-to-grok .
docker run -p 3000:3000 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json \
  -e GA4_PROPERTY_ID=123456789 \
  -v $(pwd)/service-account.json:/secrets/sa.json \
  ga-to-grok
```

Make sure the container is reachable via HTTPS (use a reverse proxy / Cloudflare / Fly.io HTTPS).

## 3. Add the connector in Grok

1. Go to [https://grok.com/connectors](https://grok.com/connectors)
2. Click **New Connector**
3. Select **Custom**
4. Paste your public MCP server URL + `/sse`  
   Example: `https://your-server.com/sse`
5. (Optional) Add authentication headers if you protected the endpoint
6. Save

Grok will discover the available tools automatically.

## 4. Test with Grok

Try these prompts:

- "List my GA4 properties"
- "Give me a traffic overview for the last 7 days"
- "What are the top pages this month?"
- "Show acquisition by channel last 30 days"
- "Which devices are used the most?"
- "What are the most frequent events?"

## Available Tools

| Tool | Description |
|------|-------------|
| `list_properties` | Discover accessible properties |
| `get_property_details` | Details of one property |
| `get_metadata` | Dimensions & metrics |
| `run_report` | Flexible custom report |
| `run_realtime_report` | Last 30 minutes |
| `get_traffic_overview` | **Recommended** – full overview |
| `get_top_pages` | Most viewed pages |
| `get_acquisition` | Channels / sources / medium |
| `get_devices` | Device / OS / browser breakdown |
| `get_events_summary` | Top events |

## Notes

- The server **must** be reachable from the public internet (Grok does not support localhost).
- Use the `/sse` endpoint for the Custom Connector.
- Keep the Service Account least-privilege (Viewer only).
- Prefer the business tools (`get_traffic_overview`, etc.) – they are optimized for Grok.

---

Need help? Open an issue on the repository.
