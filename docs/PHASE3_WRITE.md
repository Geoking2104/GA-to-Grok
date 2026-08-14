# Phase 3 — Écriture GTM contrôlée

## Outils

| Tool | Description |
|------|-------------|
| `create_custom_event_trigger` | Crée un trigger Custom Event |
| `create_ga4_event_tag` | Crée un tag GA4 Event (`gaawe`) |
| `create_ga4_event_setup` | **Recommandé** — crée trigger + tag liés |

## Garde-fous de sécurité

1. **`confirm=true` obligatoire** pour toute écriture réelle
2. **`dryRun=true`** pour prévisualiser le payload sans écrire
3. **`GTM_WRITE_ENABLED=false`** désactive toutes les écritures au niveau serveur
4. **Pas de publication automatique** — les changements restent dans le workspace
5. **Détection des doublons** — refuse de recréer un tag/trigger existant

## Scope requis

```
https://www.googleapis.com/auth/tagmanager.edit.containers
```

Le Service Account doit avoir le rôle **Edit** (pas seulement Viewer) sur le compte GTM.

## Workflow recommandé

```text
1. dryRun=true  → vérifier le payload
2. confirm=true → créer dans le workspace
3. GTM Preview → tester dataLayer.push
4. GA4 DebugView → valider la réception
5. Publish manuel dans l'UI GTM
```

## Exemple

```json
{
  "accountId": "123",
  "containerId": "456",
  "workspaceId": "3",
  "eventName": "newsletter_signup",
  "parameters": [
    { "key": "method", "value": "{{dlv - method}}" }
  ],
  "dryRun": true
}
```

Puis avec `confirm: true` pour exécuter.
