# Production go-live checklist

Use this list after Sprint 1–3 migration work is complete and before pointing production tenants at the web stack.

## Pre-cutover

- [ ] **Secrets:** `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, Keycloak (if enabled), ETA credentials, S3 keys — stored in a secrets manager, not in git.
- [ ] **Anonymous API off:** `NODE_ENV=production` and no dev bypass; all `/api/v1` calls require auth + tenant headers.
- [ ] **CORS / FRONTEND_URL:** Match the deployed web origin; verify login and API from the browser.
- [ ] **Database:** `npm run prisma:deploy` on the target MySQL; backup taken and restore tested.
- [ ] **Redis:** Enabled for cache/queues; worker process running (`npm run start:workers` or compose `worker` service).
- [ ] **Migration:** `migrate:legacy` on sanitized prod dump; `npm run recon:migration` / TB parity within agreed tolerance.
- [ ] **Smoke gate:** `npm run test:waves` green on staging with production-like env.

## ETA (if required)

- [ ] `ETA_USE_LIVE_CLIENT=true`, `ETA_API_BASE_URL`, OAuth client id/secret in `EInvoiceSetting`.
- [ ] Signing: `ETA_SIGNING_PROVIDER=mock` for preprod only; production uses PKCS#11/HSM vars (`ETA_PKCS11_MODULE_PATH`, `ETA_PKCS11_CERT_LABEL`, token PIN).
- [ ] Test submit in preprod; confirm document reaches **Valid** in ETA portal.

## Document archive (M20)

- [ ] `ARCHIVE_STORAGE_PROVIDER=s3` (or `local` for single-node only).
- [ ] S3: `ARCHIVE_S3_BUCKET`, `ARCHIVE_S3_REGION`, credentials; verify upload/list/delete from UI.

## Deploy

- [ ] Stack from [`infra/docker-compose.stack.example.yml`](../infra/docker-compose.stack.example.yml) (or K8s equivalent): MySQL, Redis, API, workers, web, TLS terminator.
- [ ] Health checks and log shipping configured.
- [ ] Rollback plan: DB restore + previous image tags documented.

## Cutover window

- [ ] Freeze Delphi posting for the company; final incremental ETL if needed.
- [ ] Re-run reconciliation (TB + stock valuation).
- [ ] Enable users; monitor errors and queue depth for 24–48h.

## Post go-live

- [ ] License modules (`TenantSubscription`) match sold verticals.
- [ ] Ops runbook: restart order (MySQL → Redis → API → workers → web), backup schedule, on-call contacts.
