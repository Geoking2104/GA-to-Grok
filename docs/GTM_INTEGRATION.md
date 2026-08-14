# Google Tag Manager ↔ GA4 Integration

**Cahier des charges & Spécifications techniques**  
Projet : **GA-to-Grok**  
Version : 1.0  
Date : 14 août 2026  
Statut : Validé pour implémentation Phase 1

---

## 1. Contexte & Objectif

Google Tag Manager (GTM) est la couche de collecte principale pour la plupart des implémentations GA4.  
L’objectif de cette intégration est de permettre à **Grok** de :

- Comprendre **comment** les données arrivent dans GA4 (via quels tags GTM)
- Auditer la qualité de la configuration GTM liée à une property GA4
- Diagnostiquer les problèmes de tracking (événements manquants, Measurement ID incorrect, paramètres absents…)
- Faire le lien clair entre un **conteneur GTM** et une **property GA4**

Référence officielle Google :  
[Configurer Google Analytics 4 avec Google Tag Manager](https://support.google.com/tagmanager/answer/14842164)

---

## 2. Périmètre fonctionnel

### 2.1 Phase 1 – Lecture seule + Audit (MVP)

| ID | Fonctionnalité | Description | Priorité |
|----|----------------|-------------|----------|
| GTM-01 | `list_gtm_accounts` | Lister les comptes GTM accessibles avec les credentials | Must |
| GTM-02 | `list_gtm_containers` | Lister les conteneurs d’un compte | Must |
| GTM-03 | `list_gtm_workspaces` | Lister les workspaces d’un conteneur | Must |
| GTM-04 | `list_gtm_tags` | Lister tous les tags d’un workspace | Must |
| GTM-05 | `get_ga4_tags` | Filtrer uniquement les tags GA4 Configuration + GA4 Event | Must |
| GTM-06 | `get_gtm_container_summary` | Résumé structuré d’un conteneur (Measurement IDs, tags GA4, triggers associés) | Must |
| GTM-07 | `audit_ga4_setup` | Audit intelligent de la configuration GA4 dans GTM | Must |
| GTM-08 | `find_measurement_ids` | Extraire tous les Measurement IDs (G-XXXXXXXX) présents dans un conteneur | Should |

### 2.2 Phase 2 – Enrichissement

- `list_gtm_triggers`
- `list_gtm_variables`
- `get_tag_details`
- Amélioration de l’audit (événements recommandés Google manquants, paramètres critiques)

### 2.3 Phase 3 – Écriture contrôlée (optionnel)

- Création / mise à jour de tags GA4 Event
- Publication de workspace (avec confirmation explicite)

---

## 3. Spécifications techniques

### 3.1 API utilisée

- **Google Tag Manager API v2**
- Endpoint de base : `https://tagmanager.googleapis.com`
- Client Node.js : `googleapis` (package déjà présent dans le projet)

### 3.2 Scopes OAuth / Service Account

| Scope | Usage |
|-------|-------|
| `https://www.googleapis.com/auth/tagmanager.readonly` | **Recommandé pour la Phase 1** (lecture seule) |
| `https://www.googleapis.com/auth/tagmanager.edit.containers` | Phase 3 uniquement |

Le Service Account utilisé pour GA4 peut être réutilisé, à condition qu’il ait les droits **Viewer** (ou Edit) sur les comptes GTM concernés.

### 3.3 Types de tags GA4 prioritaires

| Type GTM (API) | Nom affiché | Rôle |
|----------------|-------------|------|
| `googtag` | Google Tag | Tag de configuration GA4 (Measurement ID) |
| `gaawe` | Google Analytics: GA4 Event | Envoi d’événements |
| `gaawc` | Google Analytics: GA4 Configuration | Ancien type (legacy) |

### 3.4 Structure des tools (contrats MCP)

```ts
// GTM-01
list_gtm_accounts()

// GTM-02
list_gtm_containers({ accountId: string })

// GTM-03
list_gtm_workspaces({ accountId: string, containerId: string })

// GTM-04
list_gtm_tags({
  accountId: string,
  containerId: string,
  workspaceId: string
})

// GTM-05
get_ga4_tags({
  accountId: string,
  containerId: string,
  workspaceId: string
})

// GTM-06
get_gtm_container_summary({
  accountId: string,
  containerId: string,
  workspaceId?: string   // default = default workspace
})

// GTM-07
audit_ga4_setup({
  accountId: string,
  containerId: string,
  workspaceId?: string
})
```

### 3.5 Format de sortie de `audit_ga4_setup`

```json
{
  "accountId": "123456",
  "containerId": "789012",
  "workspaceId": "3",
  "measurementIds": ["G-XXXXXXXX"],
  "hasGa4ConfigTag": true,
  "ga4ConfigTagsCount": 1,
  "ga4EventTagsCount": 8,
  "ga4ConfigTags": [...],
  "ga4EventTags": [...],
  "missingRecommendedEvents": ["purchase", "add_to_cart"],
  "warnings": [
    "Le tag GA4 Configuration n'est pas déclenché sur 'All Pages'",
    "Aucun paramètre 'value' détecté sur les événements de type purchase"
  ],
  "score": 74,
  "recommendations": [
    "Ajouter un tag GA4 Event pour 'purchase'",
    "Vérifier que le Measurement ID correspond bien à la property GA4 cible"
  ]
}
```

### 3.6 Événements recommandés Google à vérifier (audit)

Liste non exhaustive utilisée pour l’audit :

- `page_view`
- `purchase`
- `add_to_cart`
- `begin_checkout`
- `generate_lead`
- `sign_up`
- `login`
- `search`
- `view_item`
- `add_payment_info`

### 3.7 Gestion des erreurs

- Permissions insuffisantes → message clair
- Workspace inexistant → erreur explicite
- Conteneur sans aucun tag GA4 → score bas + recommandations

### 3.8 Caching

- Compatible avec la couche Redis existante
- TTL recommandé :
  - listes (accounts, containers, tags) → 15–30 minutes
  - audit → 10 minutes

---

## 4. Architecture dans le repository

```text
src/
├── google/
│   ├── tagmanager-api.ts      # Client + méthodes GTM
│   └── ...
├── tools/
│   ├── gtm.ts                 # Définition des tools MCP GTM
│   └── index.ts               # Enregistrement
└── ...
```

---

## 5. Critères d’acceptation – Phase 1

- [ ] Les 7 tools Must-have sont implémentés et testables
- [ ] `audit_ga4_setup` retourne un score + warnings + recommandations
- [ ] Les Measurement IDs sont correctement extraits des tags `googtag` et `gaawe`
- [ ] Fonctionne avec un Service Account en lecture seule
- [ ] Compatible avec le transport SSE existant
- [ ] Documentation mise à jour dans le README

---

## 6. Hors scope (Phase 1)

- Création / modification / suppression de tags
- Publication de workspace
- Gestion des Server-side containers
- Variables et triggers détaillés (Phase 2)

---

## 7. Prochaines étapes

1. Implémentation Phase 1 (`src/google/tagmanager-api.ts` + `src/tools/gtm.ts`)
2. Tests manuels avec un vrai conteneur GTM
3. Mise à jour du README et de `docs/GROK_SETUP.md`
4. Packaging éventuel en plugin Grok Build

---

**Auteur** : Geoffroy de La Tournelle / KayrosLab  
**Licence** : Apache-2.0
