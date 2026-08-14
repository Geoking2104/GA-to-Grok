# GA-to-Grok CLI

Commandes alignées sur le workflow sGTM / GA4.

## Installation / build

```bash
npm install
npm run build

# via npm script
npm run cli -- help

# via bin
npx ga-to-grok-cli help
```

Variables d'environnement : voir `.env.example` (`GOOGLE_APPLICATION_CREDENTIALS` ou `GOOGLE_CREDENTIALS_JSON`).

---

## Workflow complet — une commande par étape

### 0. Discovery

```bash
npm run cli -- list-properties
npm run cli -- list-sgtm
npm run cli -- list-streams --property 123456789
npm run cli -- list-clients --account 111 --container 222 --workspace 3
```

### 1. Audit GTM Web

```bash
npm run cli -- audit-web \
  --account 111 \
  --container 222 \
  --property 123456789
```

### 2. Audit sGTM

```bash
npm run cli -- audit-sgtm --account 111 --container 999
npm run cli -- audit-mp-client --account 111 --container 999
```

### 3. Secrets & Measurement Protocol

```bash
npm run cli -- verify-secrets --property 123456789
npm run cli -- suggest-mp --property 123456789 --mode both --sgtm-url https://tags.example.com

# Création secret (dry-run puis confirm)
npm run cli -- create-mp-secret --property 123456789 --stream STREAM_ID --name backend-prod --dry-run
npm run cli -- create-mp-secret --property 123456789 --stream STREAM_ID --name backend-prod --confirm
```

### 4. Dual-tagging (S3)

```bash
npm run cli -- compare-dual \
  --web-account 111 --web-container 222 \
  --server-account 111 --server-container 999 \
  --property 123456789 \
  --start 30daysAgo --end yesterday
```

### 5. Cutover checklist (S4)

```bash
npm run cli -- cutover-checklist \
  --web-account 111 --web-container 222 \
  --server-account 111 --server-container 999 \
  --property 123456789 \
  --health-url https://tags.example.com/healthy
```

### 6. Health / observabilité (S5)

```bash
npm run cli -- health --url https://tags.example.com
npm run cli -- observability --url https://tags.example.com --property 123456789
```

### Analytics complémentaires

```bash
npm run cli -- analyze-ecommerce --property 123456789
npm run cli -- traffic --property 123456789 --start 7daysAgo
```

### Serveur MCP

```bash
npm run cli -- serve-http
npm run cli -- serve-stdio
```

---

## Scripts npm raccourcis

| Script | Commande |
|--------|----------|
| `npm run cli:audit-web` | audit-web |
| `npm run cli:audit-sgtm` | audit-sgtm |
| `npm run cli:verify-secrets` | verify-secrets |
| `npm run cli:compare-dual` | compare-dual |
| `npm run cli:cutover` | cutover-checklist |
| `npm run cli:health` | health |

Les arguments après `--` sont transmis à la CLI.
