# Server-Side Tracking Architecture

**Référence technique** — GA-to-Grok / KayrosLab  
Version : 1.0 · Août 2026  
Scope : Google Tag Manager Server-Side (sGTM) + Google Analytics 4

---

## 1. Objectif

Définir une architecture **server-side tracking** robuste, first-party, conforme (consentement / RGPD) et compatible avec l’écosystème GA4 + GTM Web déjà couvert par **GA-to-Grok**.

Objectifs business / techniques :

- Améliorer la **qualité et la résilience** des données (adblockers, ITP, cookies tiers)
- Centraliser le contrôle des flux (enrichissement, scrubbing PII, fan-out vendors)
- Garder une **source de vérité mesurable** côté GA4
- Permettre l’audit / le diagnostic via le connecteur GA-to-Grok

---

## 2. Principes directeurs

| Principe | Description |
|----------|-------------|
| **First-party** | Endpoint sGTM sur sous-domaine propre (`tags.example.com` ou path same-origin) |
| **Consent-aware** | Le consentement navigateur est propagé (`gcs` / `gcd`) et respecté côté serveur |
| **Pas de double comptage** | Un `event_id` stable pour dédup browser ↔ server / CAPI |
| **Parity avant cutover** | Dual-tagging jusqu’à parité des événements clés |
| **Least privilege** | Scrub PII avant fan-out vendors |
| **Observabilité** | Health checks, latence, taux d’erreur, réconciliation commandes vs purchases |

---

## 3. Vue d’ensemble de l’architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                              │
│  Browser / App                                                   │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │ Consent CMP  │───▶│ GTM Web container / gtag.js         │   │
│  └──────────────┘    │  - GA4 Config (server_container_url)│   │
│                      │  - Events (purchase, custom…)       │   │
│                      └──────────────┬──────────────────────┘   │
└─────────────────────────────────────┼───────────────────────────┘
                                      │ HTTPS (1st party)
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              YOUR INFRASTRUCTURE (first-party)                   │
│  DNS: tags.example.com  →  Load balancer / CDN                   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           GTM Server-Side Container (sGTM)                │  │
│  │                                                           │  │
│  │  Clients          Transformations        Tags             │  │
│  │  ────────         ───────────────        ────             │  │
│  │  • GA4 Client     • Enrich IP/geo        • GA4 Tag        │  │
│  │  • MP Client      • Scrub email/phone    • Meta CAPI      │  │
│  │  • Custom Client  • Hash identifiers     • Ads / others   │  │
│  │                                                           │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  Runtime: Cloud Run / App Engine / Docker cluster                │
└───────────────────────────────┼──────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
     ┌────────────┐      ┌────────────┐      ┌────────────┐
     │   GA4      │      │ Meta CAPI  │      │ Other APIs │
     │ property   │      │ / Ads      │      │            │
     └────────────┘      └────────────┘      └────────────┘
```

---

## 4. Composants clés

### 4.1 Côté client (Web)

- **GTM Web** ou **gtag.js** reste nécessaire (ce n’est pas “100 % server-only”).
- Configuration critique :

```js
gtag('config', 'G-XXXXXXXX', {
  server_container_url: 'https://tags.example.com',
  first_party_collection: true,
});
```

- Ou via tag **Google Tag / GA4 Configuration** dans GTM Web : champ *Server Container URL*.
- Le navigateur envoie les hits vers **votre domaine**, plus vers `google-analytics.com` en direct (selon mode).

### 4.2 Clients (sGTM)

Un **Client** intercepte les requêtes HTTP entrantes et produit un **event model** standard.

| Client | Rôle |
|--------|------|
| **Google Analytics: GA4** | Reçoit les hits web GA4 (`/g/collect`), parse en events, optionnellement sert la lib JS |
| **Measurement Protocol** | Reçoit des events server-to-server / app / backend |
| **GA4 (App)** | Flux mobile SDK vers sGTM |
| **Custom Client** | Protocoles métier spécifiques |

Règle : **un client GA4 web suffit** dans la majorité des setups.

### 4.3 Tags (sGTM)

- **Google Analytics: GA4** — renvoie l’event model vers la property GA4
- Tags vendors (Meta CAPI, Google Ads, …) déclenchés sur le même event model
- Possibilité de **transformers** avant envoi (enrichissement, mapping, filtrage)

### 4.4 Runtime d’hébergement

| Option | Usage |
|--------|--------|
| **Cloud Run** | Recommandé (scale, coût, simplicité) |
| **App Engine** | Setup “automatic” Google historique |
| **Docker manuel** | Full control (preview server + tagging servers) |

Bonnes pratiques Google :

- **1 seul preview server** (pas d’autoscaling preview)
- **Cluster** de tagging servers en prod (même `CONTAINER_CONFIG`)
- Domaine **first-party** (CNAME ou same-origin path)
- Timeout LB / CDN **> 20s** pour le mode Preview

---

## 5. Flux de données détaillé

### 5.1 Event web standard

```text
1. User action → dataLayer / gtag event
2. GTM Web tag GA4 Event se déclenche
3. Hit HTTP POST/GET → https://tags.example.com/g/collect?... 
4. GA4 Client (sGTM) claim la requête → event model
5. Triggers sGTM évalués
6. Tag GA4 (server) envoie vers google-analytics.com / MP endpoint
7. (Optionnel) Tags Meta CAPI / Ads en parallèle
8. Réponse HTTP renvoyée au navigateur
```

### 5.2 Event backend (Measurement Protocol via sGTM)

```text
Backend métier → POST https://tags.example.com/mp/collect
  → Measurement Protocol Client
  → event model
  → Tag GA4 (+ autres)
```

Utile pour : CRM, paiements confirmés, appels serveur, events offline.

### 5.3 Dual-tagging (phase de migration)

```text
Browser ──▶ GA4 (client-side)     }  même event_id
       └──▶ sGTM ──▶ GA4 (server) }  pour dédup
```

Ne passer en **server-only** qu’après parité des KPIs (purchases, leads, revenue).

---

## 6. Consentement & conformité

1. CMP (côté page) définit le consentement
2. GTM Web / gtag propage `gcs` / `gcd` (et Consent Mode v2)
3. Les tags Google **côté serveur** lisent nativement ces paramètres
4. **Ne pas** re-gate manuellement d’une façon qui casse le modèle Google
5. Scrubbing PII **avant** fan-out vers Meta / autres si non nécessaires

Checklist 2026 :

- [ ] Consent Mode v2 actif côté web
- [ ] Paramètres consent transmis à sGTM
- [ ] Pas de PII en clair dans les event params sortants
- [ ] Documentation du mapping legal basis / finalités

---

## 7. Déduplication

Pour chaque conversion critique (`purchase`, `generate_lead`, …) :

```text
event_id = stable_id  // uuid ou order_id hashé
```

- Même `event_id` sur envoi browser **et** server
- GA4 / Meta peuvent dédupliquer
- Sans cela → inflation des conversions et ROAS faussé

---

## 8. Déploiement de référence (prod)

### 8.1 DNS

```text
tags.example.com  CNAME  →  ghs.googlehosted.com  (ou LB Cloud Run)
```

### 8.2 Environnements

| Env | Rôle |
|-----|------|
| Preview | 1 instance, debug GTM |
| Production | N instances, autoscaling |

### 8.3 Variables d’environnement (runtime)

- `CONTAINER_CONFIG` — config publiée du container serveur
- `PREVIEW_SERVER_URL` — URL du preview server
- `PORT`

### 8.4 Health

- Endpoint `/healthy`
- Monitoring : latence p95, error ratio, volume events/min
- Alerte si divergence **orders CRM vs GA4 purchases** > seuil

---

## 9. Mapping avec GA-to-Grok

### 9.1 Ce qui existe déjà

| Capacité GA-to-Grok | Lien sGTM |
|---------------------|-----------|
| `list_gtm_containers` | Détecte `usageContext: SERVER` |
| `audit_ga4_setup_v2` | Audit web containers (base avant migration) |
| `validate_ecommerce_events` | Qualité schema avant/après cutover |
| `analyze_ecommerce_data` | Parité revenue / funnel post-migration |
| `compare_gtm_vs_ga4_events` | Écarts config vs reçu |

### 9.2 Roadmap support sGTM dans le connecteur

| Phase | Feature |
|-------|---------|
| **S1** | Détection explicite containers `SERVER` + résumé clients/tags serveur |
| **S2** | Audit sGTM : présence GA4 Client, tag GA4 server, Measurement Protocol client |
| **S3** | Comparaison dual-tagging (property “web only” vs “via sGTM”) |
| **S4** | Recommandations cutover (parity checklist) |
| **S5** | (Optionnel) lecture logs / health si endpoint exposé |

> L’API Tag Manager v2 expose aussi workspaces/tags pour containers serveur ; les tools existants peuvent être étendus avec un filtre `usageContext`.

---

## 10. Architecture cible recommandée (KayrosLab / e-commerce)

```text
                    ┌─ GA4 (reporting + Ads linking)
Browser ─▶ GTM Web ─┤
                    └─▶ sGTM (tags.example.com)
                           ├─ GA4 Tag (server)
                           ├─ Meta CAPI (deduped)
                           └─ Optional: CRM webhook / warehouse

Backend orders ──▶ sGTM MP Client ──▶ GA4 purchase (authoritative)
```

**Règles :**

1. Web envoie le funnel + page_view via sGTM
2. **Purchase confirmé** idéalement aussi (ou uniquement) depuis le backend via MP → sGTM
3. `transaction_id` / `event_id` uniques et partagés
4. GA-to-Grok utilisé pour : audit config → validate ecommerce → analyze real data → comparer parité

---

## 11. Checklist de mise en production

**Avant**

- [ ] Measurement plan figé (events + params + consent)
- [ ] GA4 web propre (`validate_ecommerce_events` score élevé)
- [ ] Property / data stream prêts

**Infra**

- [ ] Runtime sGTM déployé (Cloud Run / App Engine)
- [ ] Domaine first-party + TLS
- [ ] Preview server isolé
- [ ] `/healthy` monitoré

**Container serveur**

- [ ] GA4 Client configuré
- [ ] GA4 Tag server configuré
- [ ] Consent params préservés
- [ ] Pas de PII inutile en sortie

**Web**

- [ ] `server_container_url` configuré
- [ ] Dual-tagging + `event_id` si migration progressive

**Validation**

- [ ] Preview sGTM OK
- [ ] DebugView GA4 OK
- [ ] `analyze_ecommerce_data` cohérent vs période précédente
- [ ] Réconciliation commandes vs `purchase`

**Cutover**

- [ ] Arrêt progressif des hits client-side directs
- [ ] Monitoring 48–72h

---

## 12. Hors scope (volontaire)

- Remplacement complet de GTM Web (toujours requis pour la collecte initiale navigateur)
- Hébergement on-prem non containerisé
- Custom clients complexes (traités au cas par cas)
- Publication automatique de containers serveur via API (Phase 3 actuelle = web workspace only)

---

## 13. Références

- [Introduction to server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/intro)
- [Send data to server-side Tag Manager](https://developers.google.com/tag-platform/tag-manager/server-side/send-data)
- [Manual setup guide](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide)
- [GA4 + server-side fundamentals](https://developers.google.com/tag-platform/learn/sst-fundamentals/5-sst-setup-analytics)

---

**Auteur** : Geoffroy de La Tournelle / KayrosLab  
**Licence** : Apache-2.0  
**Projet** : [GA-to-Grok](https://github.com/Geoking2104/GA-to-Grok)
