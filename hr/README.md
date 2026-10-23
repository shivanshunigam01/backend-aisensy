# PeopleFlow API (`@peopleflow/api`)

Full HR + recruitment SaaS backend for Zentroverse.

## Mount

Built with `npm run hr:build` and mounted at **`/api/v1`** on the main server ([`../src/peopleflow/mount.js`](../src/peopleflow/mount.js)).

## Local (standalone)

```bash
cp .env.example .env
npm install
npm run dev
```

Health: `GET http://localhost:4000/api/v1/health`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm test` | Vitest |

Parent repo: from `backend-aisensy/`, run `npm run hr:install` once, then `npm run dev` (builds HR + starts unified API on port 8787).
