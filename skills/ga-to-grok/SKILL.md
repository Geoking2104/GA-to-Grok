---
name: ga-to-grok
description: Use Google Analytics 4, Google Tag Manager (web + server-side), and Measurement Protocol through the GA-to-Grok MCP server. Trigger on GA4, GTM, sGTM, Measurement Protocol, ecommerce events, dual-tagging, cutover, traffic reports, acquisition, realtime analytics, or when the user mentions GA-to-Grok.
license: Apache-2.0
metadata:
  source: https://github.com/Geoking2104/GA-to-Grok
  version: "1.0"
---

# GA-to-Grok

Work with **GA4 + GTM web + sGTM + Measurement Protocol** via the open-source MCP server https://github.com/Geoking2104/GA-to-Grok.

This skill does not replace Google credentials. It tells you how to discover tools, pick the right one, sequence audits, and stay safe on writes.

## First action every session

1. Discover live tools (names vary by connector prefix)
   ```bash
   grok-mcp ls --query "ga4"
   grok-mcp ls --query "gtm"
   grok-mcp ls --query "sgtm"
   grok-mcp ls --query "measurement"
   ```
2. If nothing matches, the MCP is not connected. Explain setup (see `references/setup.md`) and do not invent numbers.
3. Call tools with the exact name from `ls` (often `ga-to-grok__list_properties` or a Custom Connector name).
   ```bash
   grok-mcp call <exact_tool_name> '{"propertyId":"123456789","startDate":"7daysAgo","endDate":"today"}'
   ```

Never fabricate GA4 metrics. If a call fails (auth, 403, missing property), report the error and the next permission step.

## How to choose a tool

Prefer business tools over raw `run_report` unless the user asks for custom dimensions/metrics.

| User intent | Tool |
|---|---|
| List properties / pick a property | `list_properties`, `get_property_details` |
| Traffic last N days | `get_traffic_overview` |
| Top pages | `get_top_pages` |
| Channels / source-medium | `get_acquisition` |
| Device / OS / browser | `get_devices` |
| Event catalog | `get_events_summary`, `list_custom_events` |
| Live last 30 min | `run_realtime_report` |
| Revenue / AOV / funnel | `analyze_ecommerce_data` |
| Dimensions and metrics catalog | `get_metadata` |
| Ad-hoc report | `run_report` |

Dates accept GA4 relative strings (`today`, `yesterday`, `7daysAgo`, `28daysAgo`, `30daysAgo`) or `YYYY-MM-DD`. Default to last 7 or 28 days if the user is vague. `propertyId` is optional when `GA4_PROPERTY_ID` is set on the server.

GTM / sGTM / MP catalogs and write gates — `references/tools.md`.

## Standard workflows

### A. Analytics briefing (read-only)

1. `list_properties` if property unknown
2. `get_traffic_overview` (period)
3. `get_acquisition` + `get_top_pages` + `get_devices`
4. `get_events_summary`
5. If commerce site — `analyze_ecommerce_data`
6. Summarize in the user's language — users, sessions, engagement, top sources, anomalies. Cite dates and property id.

### B. GTM web audit

1. `list_gtm_accounts` then `list_gtm_containers` then `list_gtm_workspaces`
2. `audit_ga4_setup_v2` (pass `propertyId` to compare live events)
3. `validate_ecommerce_events` on ecommerce sites
4. `compare_gtm_vs_ga4_events` for config vs received
5. Report score/grade, blocking issues, then recommended fixes. Do not publish workspaces.

### C. Server-side tracking / cutover

Follow this order (do not skip)

1. Stabilize web — `audit_ga4_setup_v2` + `validate_ecommerce_events`
2. `list_sgtm_containers` then `audit_sgtm_setup`
3. `verify_ga4_secrets` then `suggest_measurement_protocol_config`
4. `compare_dual_tagging`
5. `cutover_checklist` (optional `sgtmHealthUrl`)
6. `check_sgtm_health` / `sgtm_observability_snapshot`
7. Advise progressive `server_container_url`, 48–72h parity watch, then stop client-side direct hits only when ready flags are true

Architecture notes — `references/sgtm.md`.

### D. Custom event

1. `list_custom_events` / `analyze_custom_event`
2. `suggest_custom_event_config`
3. Writes only after explicit user confirmation — `create_ga4_event_setup` with `dryRun=true` first, then `confirm=true`

## Write safety

Tools that mutate Google config

- `create_measurement_protocol_secret`, `configure_measurement_protocol` (if `createSecretName`)
- `create_custom_event_trigger`, `create_ga4_event_tag`, `create_ga4_event_setup`

Rules

- Never set `confirm=true` unless the user explicitly asked to write.
- Always run `dryRun=true` first and show the preview.
- Writes do not publish the GTM workspace.
- Server flags `GA4_WRITE_ENABLED` / `GTM_WRITE_ENABLED` may block writes — say so if the API returns that.
- Never print a full MP `secretValue` in logs or shared docs. Tell the user it is shown once and must be stored in a secret manager.
- Never request or echo the Service Account private key.

## Answer style

- Lead with the decision (healthy / broken / ready for dual-tagging / not ready).
- Then 3–7 numbered actions.
- Tables for metrics; call out data-quality warnings from ecommerce tools.
- Match the user's language (French or English).
- If MCP is missing, give the shortest path to connect (grok.com Custom Connector URL `/sse`, or local stdio from the repo) instead of guessing data.

## Source of truth

Repo — https://github.com/Geoking2104/GA-to-Grok

- Setup for Grok Build and grok.com connectors — `references/setup.md`
- Full tool list and typical arguments — `references/tools.md`
- sGTM dual-tagging / cutover — `references/sgtm.md`
