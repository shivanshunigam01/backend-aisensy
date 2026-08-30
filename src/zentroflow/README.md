# ZentroFlow 2.0 Module

Separate multi-tenant lead CRM inside this backend (`/api/zentroflow`).

## What is included (SRS MVP + shells)

- Tenants, branches, users (RBAC), audit logs
- Customer vs Lead/Opportunity model with full source attribution
- Lead list, Lead 360, remarks, follow-ups, stages, verification queue
- Normalized ingest: `POST /api/zentroflow/v1/leads/ingest`
- Meta webhook: `GET|POST /api/zentroflow/webhooks/meta` + retrieve job
- Routing/assignment history, scoring/temperature, job failure console
- Automation rules, CAPI event queue hooks, WhatsApp/email/voice integration shells

## Env keys (paste when ready)

```
ZF_JWT_SECRET=
ZF_SEED_EMAIL=flow@zentroverse.in
ZF_SEED_PASSWORD=ZentroFlow@2026
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_SYSTEM_USER_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_VERSION=v21.0
```

Seeded super admin: `flow@zentroverse.in` / `ZentroFlow@2026` (override via env).

## Quick test

1. Start backend (`npm run dev` in `backend`).
2. Admin → **ZentroFlow** → create tenant → set active → ingest test lead.
3. Portal login: `/zentroflow/login` (use client admin created at onboard, or seed super admin + pick tenant).
4. Meta webhook URL: `https://YOUR_API/api/zentroflow/webhooks/meta`

## Collections (Mongo)

All prefixed `zf_`: tenants, branches, users, customers, leads, activities, followups, assignments, integrations, jobs, audit_logs, automation_rules, capi_events, products.
