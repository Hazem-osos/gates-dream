# Phase 5 — Production Runbook & Auth Hardening

**Roadmap status:** Sprints 1–3 complete — see [`ROADMAP.md`](./ROADMAP.md).

Covers Sprint 1 of the migration roadmap: turning off the open development API,
the environment matrix both services need, and the deploy / verify / rollback loop.

---

## 1. API auth modes

`/api/v1` used to attach a synthetic admin + the first active company to every request.
That path is now behind an explicit mode switch resolved once at boot in
`gates-backend/src/shared/middleware/api-auth-mode.middleware.ts`.

| `API_AUTH_MODE` | Behaviour | Allowed when `NODE_ENV=production` |
|---|---|---|
| `enforce` | `authenticate` runs on every `/api/v1` request; missing/expired JWT → 401 | yes (default) |
| `anonymous` | synthetic admin context (local development only) | no — startup throws |

Rules baked in:

- `NODE_ENV=production` always resolves to `enforce`, even if the variable is unset.
- `API_AUTH_MODE=anonymous` together with `NODE_ENV=production` throws at startup, so a
  misconfigured deploy fails loudly instead of serving an open API.
- `anonymousApiContext` itself also refuses to run under `NODE_ENV=production` (defence in depth).
- Any unrecognised value throws.

The frontend mirrors this with `NEXT_PUBLIC_AUTH_MODE` (`enforce` | `anonymous`, defaults to
`enforce` in production builds):

- `gates-web/middleware.ts` redirects unauthenticated navigations to `/login?redirect=…`.
  Public paths: `/login`, `/register`, `/forgot-password`, `/logout`.
- `lib/api/client.ts` clears the token on 401 and, when enforcing, bounces to `/login`.
- `/login` posts to `NEXT_PUBLIC_AUTH_LOGIN_PATH` (default `/auth/login`) and stores the
  access token via `apiClient.setAuthToken` (localStorage + cookie for the Edge middleware).
- `/logout` clears the token *and* the stored tenant selection.

### Roles when Keycloak is off

With `KEYCLOAK_ENABLED=false` the locally-signed JWT has no `realm_access`, so `authorize()`
had nothing to match and every route would 403 under `enforce`. Two things close that:

- `authorize()` now honours grant-all `UserPermission` rows (`resource: '*'`) in addition to
  exact resource matches.
- `POST /auth/login` derives `realm_access.roles = ['admin']` when the user holds such a row,
  and `prisma/seed.ts` grants them to the seeded `owner` user for all five actions
  (`view`, `edit`, `delete`, `approve`, `post`).

For real tenants, provision per-user rows via `/api/v1/permissions` instead of granting `*`.

### Tenant headers

`tenantAndFiscalContextMiddleware` resolves company / branch / fiscal year from the JWT plus
the `X-Company-Id`, `X-Branch-Id`, `X-Fiscal-Year-Id` headers. An explicit `X-Branch-Id`
now wins over the JWT default (it is the user's active branch selection);
a mismatched `X-Company-Id` is rejected with 403.

`requirePostingContext` (same module) is the guard for endpoints that hit the ledger: it
requires branch **and** an Open fiscal year before posting/unposting.

---

## 2. Environment matrix

### gates-backend

| Variable | Production requirement |
|---|---|
| `NODE_ENV` | `production` |
| `API_AUTH_MODE` | unset or `enforce` |
| `PORT` | listen port (behind reverse proxy) |
| `DATABASE_URL` | MySQL DSN, dedicated non-root user |
| `FRONTEND_URL` / `CORS_ORIGINS` | exact public web origins (no wildcards) |
| `JWT_DEV_SECRET` | ≥32 random chars — only when `KEYCLOAK_ENABLED=false` |
| `KEYCLOAK_*` | required when `KEYCLOAK_ENABLED=true` |
| `REDIS_ENABLED` / `REDIS_URL` | `true` + HA endpoint (cache + BullMQ workers) |
| `ARCHIVE_STORAGE_PROVIDER` | `s3` for multi-tenant cloud, plus `ARCHIVE_S3_*` |
| `ETA_USE_LIVE_CLIENT` / `ETA_SIGNING_PROVIDER` | `true` / `pkcs11` only once the token is provisioned |
| `LEGACY_*` | ETL only — leave unset on app servers |

### gates-web

| Variable | Production requirement |
|---|---|
| `NEXT_PUBLIC_API_URL` | full public API base (build fails without it) |
| `NEXT_PUBLIC_AUTH_MODE` | unset or `enforce` |
| `NEXT_PUBLIC_AUTH_LOGIN_PATH` | `/auth/login` |
| `BACKEND_PROXY_TARGET` | only when Next proxies the API |

Both `.env.example` files are the source of truth; keep them in sync when adding variables.

---

## 3. Deploy sequence

```bash
# 1. Backend: schema first (never `migrate dev` in production)
cd gates-backend
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build

# 2. Start API + workers (separate processes/containers)
npm run start
npm run start:workers

# 3. Frontend
cd ../gates-web
npm ci
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 npm run build
npm run start
```

### Pre-deploy gate

```bash
cd gates-backend
npm run type-check
npm run lint
npm run test:waves          # all wave smoke suites + ETL pipeline + recon, one summary table
```

`npm run test:waves <filter>` runs a subset, e.g. `npm run test:waves wave1`.

Data cutovers additionally require a green parity report — see
[`06-migration-reconciliation.md`](06-migration-reconciliation.md).

### Post-deploy verification

```bash
curl -fsS https://api.example.com/health/ready
# 401 expected — proves the anonymous path is gone
curl -s -o /dev/null -w '%{http_code}\n' https://api.example.com/api/v1/companies
# 200 expected with a real token
curl -fsS -H "Authorization: Bearer $TOKEN" https://api.example.com/api/v1/auth/me
```

---

## 4. Rollback

1. **App only** — redeploy the previous image; Prisma migrations are additive, so the old
   build keeps working against the newer schema in the common case.
2. **Schema** — restore the pre-deploy dump (`mysqldump` taken in the freeze window),
   then redeploy the matching app version. Prisma has no down-migrations here.
3. **Legacy ETL** — `migrate:legacy` writes under one target company id; roll back by
   deleting that company's rows (cascades) and re-running, rather than patching in place.

Backups: nightly `mysqldump` plus binlogs, restore rehearsed monthly. The document archive
is a separate durability concern — see `ARCHIVE_STORAGE_PROVIDER`.
