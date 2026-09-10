# PeopleFlow HR backend (moved)

This folder is the full **PeopleFlow** TypeScript API originally at  
`hr-module/hr-module-master/backend`.

## How Zentroverse uses HR

| Surface | Path | Notes |
|--------|------|--------|
| **Integrated API** (create-space) | `../src/hr` → `/api/hr/*` | Express 4 + mongoose 8, `hr_*` collections |
| **Full PeopleFlow package** | this folder | Optional standalone: recruitment suite, AI interviews, etc. |

## Standalone (optional)

```bash
npm install
cp .env.example .env   # set MONGODB_URI + JWT secrets
npm run dev            # http://localhost:4000/api/v1
```

From parent `backend/`:

```bash
npm run hr:install
npm run hr:dev
```

create-space talks to the **integrated** `/api/hr` module, not this package’s port 4000, unless you point the UI elsewhere.
