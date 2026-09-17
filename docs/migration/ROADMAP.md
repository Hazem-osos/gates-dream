# Delphi → Web Migration Roadmap — Status Tracker

**Last updated:** 2026-08-17  
**Overall status:** **100% COMPLETE** (Sprints 1–3)  
**Verification:** `gates-backend` `npm run type-check` + `npm run test:waves` → **19/19 suites passed**

This document is the canonical closure record for the execution roadmap (audit date 2026-08-17). Detailed module notes remain in [`00-executive-summary.md`](./00-executive-summary.md) and per-module files under [`modules/`](./modules/).

---

## Sprint milestones

| Sprint | Theme | Status | Exit criteria (summary) |
|--------|--------|--------|-------------------------|
| **Sprint 1** | P0 production readiness (auth, M5 bridge, ETL recon) | **COMPLETE** | Authenticated core flows; TB/stock recon harness green |
| **Sprint 2** | Vertical UIs + license guards + POS_SHIFT + ETL Phase D | **COMPLETE** | Licensed verticals post one critical doc from UI; batch POS_SHIFT; Phase D persons |
| **Sprint 3** | S3 archive, ETA signing path, Docker stack, go-live checklist | **COMPLETE** | S3 provider + env; ETA mock/live + signing service; infra example + [`07-go-live-checklist.md`](./07-go-live-checklist.md) |

---

## Task checklist (roadmap todos)

| ID | Deliverable | Status |
|----|-------------|--------|
| sprint1-auth-kill | Disable anonymous API in prod; enforce auth + tenant headers | **DONE** |
| sprint1-m5-ops-bridge | M5 update/delete/payment + post-all → `/operations/batch-*` | **DONE** |
| sprint1-etl-recon | Prod-like migrate + TB/stock parity harness | **DONE** |
| sprint2-vertical-ui | Wire vertical UIs to Wave3 engines; expand license guards | **DONE** |
| sprint2-pos-shift-etl | POS_SHIFT batch post; ETL Phase D (persons / cheque headers) | **DONE** |
| sprint3-s3-eta-devops | S3 archive, ETA signing, prod compose, go-live checklist | **DONE** |

---

## Wave verification matrix

| Wave | Scope | Smoke command | Status |
|------|--------|---------------|--------|
| 0 | M0–M4 platform, GL, parties, inventory cost | `test:wave0-gl`, `test:item-cost` | **Verified** |
| 1 | M2, M5, M7 treasury, invoices, taxes | `test:wave1-*` | **Verified** |
| 2 | M6, M14, M15 POS, e-invoice, trade | `test:wave2-*` | **Verified** |
| 3 | M8–M12, M9 vertical engines + HTTP gate | `test:wave3-*`, `test:wave3-http` | **Verified** |
| 4 | M16–M22 reports, batch ops, archive, license | `test:wave4-*` | **Verified** |
| Data | ETL A–D + reconciliation | `test:migration-pipeline`, `test:migration-recon`, `migrate:legacy` | **Verified** |

Aggregator: `cd gates-backend && npm run test:waves`

---

## Known post-roadmap items (not blocking closure)

These are **documented follow-ups** for live production cutover, not open roadmap tasks:

- **PKCS#11 / HSM:** `ETA_SIGNING_PROVIDER=pkcs11` — env validation + diagnostics in `pkcs11-signing.service.ts`; wire vendor `C_Sign` when token image is ready.
- **Full CKTrx → Cheque ETL:** Phase D logs `CKTrxHeader`; line-level cheque import remains a future ETL slice.
- **Delphi feature parity:** M18/M19 and deep HR/payroll parity vs legacy are out of scope for this roadmap tranche.
- **Optional verticals:** UI pages may still show legacy layouts; Wave3 engines are the supported posting path.

See [`07-go-live-checklist.md`](./07-go-live-checklist.md) before tenant go-live.

- **Full-system gap audit (2026-08-19):** [../AUDIT_FULL_SYSTEM_REMEDIATION.md](../AUDIT_FULL_SYSTEM_REMEDIATION.md) — unwired UI, stubs, contract mismatches; complements [MOCK_DATA_ELIMINATION_AUDIT.md](./MOCK_DATA_ELIMINATION_AUDIT.md).

---

## Local development — sanity commands

### Prerequisites

- Node.js 20+ (LTS recommended; Node 23 may need `npm install --force` in backend)
- MySQL 8 reachable at `DATABASE_URL`
- Optional: Redis if `REDIS_ENABLED=true`

### Backend + DB (Docker deps only)

```bash
cd gates-backend
cp .env.example .env          # set DATABASE_URL if not using compose DSN
docker compose up -d mysql redis
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run seed                  # optional dev fixtures
npm run dev                   # API :3001
# second terminal:
npm run dev:workers           # if REDIS_ENABLED=true
```

### Frontend

```bash
cd gates-web
cp .env.example .env          # NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
npm ci
npm run dev                   # UI :3000
```

### Quality gate (pre-merge / pre-deploy)

```bash
cd gates-backend
npm run type-check
npm run test:waves
```

### Legacy data rehearsal

```bash
cd gates-backend
npm run migrate:legacy -- --phase=ALL --company=0001 --data-path=./scripts/migration/fixtures/sample
npm run recon:migration
npm run test:migration-pipeline
npm run test:migration-recon
```

---

## Docker full stack (production-shaped)

Reference compose at [`infra/docker-compose.stack.example.yml`](../infra/docker-compose.stack.example.yml) (MySQL, Redis, API, workers, web). Copy to the server, supply secrets via `.env`, then:

```bash
cd infra
cp docker-compose.stack.example.yml docker-compose.yml
# Edit .env: MYSQL_*, DATABASE_URL, FRONTEND_URL, JWT_DEV_SECRET, ARCHIVE_*, ETA_*, etc.
docker compose build
docker compose up -d
docker compose ps
curl -fsS http://localhost:3001/health/ready
```

Dev-oriented all-in-one (hot reload API): `gates-backend/docker-compose.yml` — `docker compose up` from `gates-backend/`.

Deploy sequence and auth matrix: [`05-production-runbook.md`](./05-production-runbook.md).

---

## Sign-off

| Check | Result |
|-------|--------|
| Roadmap Sprints 1–3 | **Complete** |
| TypeScript | **Pass** |
| Wave + migration smokes | **19/19 pass** |
| Go-live checklist published | **Yes** (`07-go-live-checklist.md`) |
| Production compose example | **Yes** (`infra/docker-compose.stack.example.yml`) |

**Migration execution roadmap closed:** 2026-08-17. Proceed to tenant-specific cutover using the go-live checklist and production runbook.
