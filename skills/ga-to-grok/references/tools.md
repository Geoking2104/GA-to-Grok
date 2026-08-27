# GA-to-Grok MCP tools

Unprefixed names as registered by the server. Grok may prefix them (`ga-to-grok__…`). Always `grok-mcp ls` first.

Common ids

- `propertyId` — numeric GA4 property (no `properties/` prefix unless the tool already accepts it)
- `accountId`, `containerId`, `workspaceId` — GTM ids as strings
- dates — `today`, `yesterday`, `NdaysAgo`, or `YYYY-MM-DD`

## GA4

| Tool | Typical args | Notes |
|---|---|---|
| `list_properties` | none | Start here |
| `get_property_details` | propertyId | |
| `get_metadata` | propertyId? | Dimensions and metrics catalog |
| `run_report` | metrics[], startDate, endDate, dimensions?, limit? | Last resort |
| `run_realtime_report` | metrics[], dimensions?, limit? | Last ~30 minutes |
| `get_traffic_overview` | propertyId?, startDate?, endDate? | Users, sessions, views, bounce |
| `get_top_pages` | propertyId?, dates, limit? | |
| `get_acquisition` | propertyId?, dates, limit? | Channel / source / medium |
| `get_devices` | propertyId?, dates | Device, OS, browser |
| `get_events_summary` | propertyId?, dates, limit? | |
| `analyze_ecommerce_data` | propertyId, dates?, limit? | Purchases, revenue, AOV, funnel, quality warnings |

## GTM web (read)

| Tool | Typical args |
|---|---|
| `list_gtm_accounts` | none |
| `list_gtm_containers` | accountId |
| `list_gtm_workspaces` | accountId, containerId |
| `list_gtm_tags` | accountId, containerId, workspaceId |
| `get_ga4_tags` | accountId, containerId, workspaceId |
| `get_gtm_container_summary` | accountId, containerId, workspaceId? |
| `list_gtm_triggers` | accountId, containerId, workspaceId |
| `get_trigger_details` | + triggerId |
| `list_gtm_variables` | accountId, containerId, workspaceId |
| `get_variable_details` | + variableId |
| `get_tag_details` | + tagId |
| `analyze_event_parameters` | accountId, containerId, workspaceId |
| `compare_gtm_vs_ga4_events` | + propertyId, dates? |
| `audit_ga4_setup` | legacy — prefer v2 |
| `audit_ga4_setup_v2` | accountId, containerId, workspaceId?, propertyId?, dates? |
| `validate_ecommerce_events` | accountId, containerId, workspaceId, propertyId?, dates? |

## Custom events (read)

| Tool | Typical args |
|---|---|
| `list_custom_events` | propertyId, dates?, limit? |
| `analyze_custom_event` | propertyId, eventName, dates? |
| `suggest_custom_event_config` | eventName, parameters?, measurementId?, GTM ids? |

## GTM writes (Phase 3 — gated)

All require `confirm=true` to execute. Prefer `dryRun=true` first. Do not publish.

| Tool | Typical args |
|---|---|
| `create_custom_event_trigger` | accountId, containerId, workspaceId, eventName, triggerName?, dryRun?, confirm? |
| `create_ga4_event_tag` | + tagName?, measurementId?, parameters[{key,value}]?, firingTriggerIds? |
| `create_ga4_event_setup` | trigger + tag in one call — preferred |

## sGTM and Measurement Protocol

| Tool | Typical args |
|---|---|
| `list_sgtm_containers` | none |
| `list_gtm_clients` | accountId, containerId, workspaceId |
| `get_gtm_client_details` | + clientId |
| `audit_sgtm_setup` | accountId, containerId, workspaceId? |
| `audit_measurement_protocol_client` | accountId, containerId, workspaceId?, clientId? |
| `compare_dual_tagging` | webAccountId, webContainerId, serverAccountId, serverContainerId, propertyId, workspace ids?, dates? |
| `cutover_checklist` | same + sgtmHealthUrl? |
| `check_sgtm_health` | url, paths?, timeoutMs? |
| `sgtm_observability_snapshot` | sgtmHealthUrl, propertyId? |
| `list_data_streams` | propertyId |
| `list_measurement_protocol_secrets` | propertyId, dataStreamId, revealSecrets? |
| `verify_ga4_secrets` | propertyId, revealSecrets? |
| `suggest_measurement_protocol_config` | propertyId, dataStreamId?, mode?, sgtmBaseUrl? |
| `create_measurement_protocol_secret` | propertyId, dataStreamId, displayName, dryRun?, confirm? |
| `configure_measurement_protocol` | propertyId, mode?, sgtmBaseUrl?, createSecretName?, dryRun?, confirm? |

`mode` on MP helpers is typically `direct`, `sgtm`, or `both`.

## CLI twin (same repo, outside Grok)

```
npm run cli -- list-properties
npm run cli -- audit-web --account WEB --container WEB --property 123
npm run cli -- audit-sgtm --account SRV --container SRV
npm run cli -- verify-secrets --property 123
npm run cli -- cutover-checklist ...
```

See repo `docs/CLI.md`.
