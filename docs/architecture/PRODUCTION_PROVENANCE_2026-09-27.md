# Production Provenance — 2026-09-27

Forensic, read-only record of what Gates production runs, compared with Git HEAD
and the dirty working tree. Nothing in production, the application, the schema,
the database or Git was changed. The only writes were immutable archives outside
the repository and this file.

Related: `HEAD_BASELINE_GAP_AUDIT.md`, `REMEDIATION_BOARD.md` (not edited).

---

## 0. Three realities, one answer

| Reality | What it is | Recoverable? |
|---|---|---|
| Git HEAD `45fd5be` | never pushed (`origin/main` = `3e6313b`), 177 migrations, 46 tsc errors | yes, exactly |
| Dirty working tree | still being edited by other sessions | only as frozen at 17:16:00 (+ later deltas) |
| Production | **backend `a51bbc32`, web `565d6cab`, workers `bbbfa37d`** | **yes, exactly** — hashed inside the running containers and archived |

Production backend and web are byte-identical to the live dirty tree at their
upload times. Production workers still run a 2026-09-24 upload. HEAD is not what
production runs.

## 1. Frozen snapshot (Phase 1)

| Item | Value |
|---|---|
| Path | `/Users/hazem/Desktop/gates-provenance/snapshot-2026-09-27T171600+0300/` (read-only) |
| Per-file manifest | `…/MANIFEST.sha256` (sha256 `a0e36db8f7b8fd5e10b5ad98e15a433bbbfe5c635153b881978c1ba95374891e`) |
| Tarball | `…/source.tar` (sha256 `d22177f5934ad9cade606e2141888d5d465012661d4ecd259764fa7874c93ae1`), seals `source/`, manifest, `meta/` |
| Archive hashes | `…/ARCHIVE.sha256` |
| Window | 2026-09-27 17:16:00 → 17:16:19 +0300 (each file hashed from the same bytes that were written) |
| Branch / HEAD | `main` / `45fd5beec3b5979454b8cf325532fe9f157ff824`; 4 ahead of `origin/main`; 1 stash; 3 worktrees |
| Status entries | 969 (`git status --porcelain`), 990 with `-uall`; 837 tracked changes; 153 untracked files |
| Files archived | 3,287 regular files (28.3 MB) = tracked + untracked non-ignored; 12 tracked files deleted in the tree (listed in `meta/deleted-or-missing-tracked.txt`) |
| Also recorded | `meta/`: status, diff --stat, diff --name-status, untracked list, stash list, worktree list, `tracked-changes.binary.patch`, `manifest-detail.tsv` (size + mtime) |
| Excluded (`.gitignore`) | `node_modules`, `.next`, `dist`, `storage/`, `test-results`, `tsconfig.tsbuildinfo`, `next-env.d.ts`, `.DS_Store`, `.vscode`, `gates-web/.git.local-backup`, `gates-web/playwright/.auth` (session secrets), `scripts/migration/fixtures/prod-like` (data), `.env` files (secrets; `.env.example` kept) |

Verification: `cd source && shasum -a 256 -c ../MANIFEST.sha256`.

## 2. Moving-tree boundary (Phase 2)

- 18:09: 34 files changed and 4 added versus the freeze (report services and
  tests, web report pages, onboarding guard, API client/error localisation).
  Record: `/Users/hazem/Desktop/gates-provenance/boundary/live-vs-frozen-2026-09-27T1809.txt`.
- ~18:25: 42 changed, 4 added, 0 removed.

From here on: **FROZEN SNAPSHOT** = 17:16:00–17:16:19. **LIVE DIRTY TREE** = anything
later. Production contains some post-freeze edits (§5), so the frozen snapshot
is close to, but not equal to, production.

## 3. Railway deployment provenance (Phase 3)

Project `invigorating-exploration` (`3458eba0-9150-4fe7-95e5-7b5f356f4a5e`),
environment `production` (`9ebbcf70-…`). Services: `gates-backend`, `gates-web`,
`gates-workers`, `MySQL` (image `mysql:9`, 9.7.2), `Redis` (`redis:8.2`).

Mechanism: every app deployment is a CLI upload (`railway up`, `cliCaller=cursor`,
service source `repo=null, image=null`). No Git integration, no commit SHA.
Builder is **Railpack v0.40.0** (service manifest `builder: RAILPACK`), not the
Nixpacks setting in `railway.json`. Backend build = `npm run railway:build`
(`prisma generate`); start = `node scripts/railway-start.mjs` →
`tsx src/index.ts` (runs TypeScript source directly; no `dist`).

### Currently serving (read from inside each container)

| Service | `RAILWAY_DEPLOYMENT_ID` | Created (+0300) | Process start (+0300) | Upload message |
|---|---|---|---|---|
| gates-backend | `a51bbc32-ae25-446c-b10d-224d64f3fef7` | 17:47:52 | 17:50:22 | "Deploy API and apply pending Prisma migrations" |
| gates-web | `565d6cab-07bb-4408-a566-98b648bb1ccd` | 17:58:04 | 18:01:33 | "Fix web type errors blocking the build" |
| gates-workers | `bbbfa37d-81cd-4f7f-960a-ed2c668a1f0e` | 2026-09-24 17:22:40 | 2026-09-24 17:27:17 | "Deploy workers with latest backend" |

Backend upload snapshot (build log): `sha256:7890dd4510ed1b9f5636bdf7c45a4ecceba357a5e26a4b6e6a73f17603caab3c` (2.7 MB).
Snapshot IDs: backend `fdfa2e4e-…`, web `5b40fb38-…`, workers `b3d78727-…`.
`/health` uptime at 18:13 confirmed the 17:50 backend start.

### Today's history

| Service | Deployment | Created (+0300) | Status | Evidence |
|---|---|---|---|---|
| backend | `56efd865` | 14:58:32 | REMOVED (superseded) | deploy log: applied `20260927150000_company_settings_logo_longtext`, "All migrations have been successfully applied"; healthy start 15:01 |
| backend | `5de14a0f` | 15:27:13 | REMOVED | 185 migrations, none pending; started 15:28; logs show repeated `P2003` in `itemCostHistory.upsert` → "Transfer saved; post skipped" |
| backend | `ad9ebb83` | 16:01:25 | REMOVED | healthcheck succeeded; 185 migrations, none pending; started 16:02 |
| backend | **`a51bbc32`** | 17:47:52 | **SUCCESS (serving)** | 185 migrations, none pending; started 17:50 |
| web | `b2e9552a` | 14:58:33 | REMOVED (served until 17:58) | — |
| web | `77474a08` | 16:01:43 | FAILED | build failed |
| web | `c81944a1` | 17:47:53 | FAILED | build failed |
| web | `c082f007` | 17:52:40 | FAILED | build failed |
| web | **`565d6cab`** | 17:58:04 | **SUCCESS (serving)** | — |

The ~15:00, ~15:30 and ~16:00 backend uploads all succeeded and were superseded;
the ~16:00 web upload failed (web kept serving the 14:58 build until 17:58).
Older build logs are truncated by Railway (12–63 lines retained). Logs and the
full deployment lists are kept under `/Users/hazem/Desktop/gates-provenance/production-backend-a51bbc32/meta/`
and `/tmp/prov-dl-*.json`.

## 4. Can production identify its source? (Phase 4)

No. The application exposes no Git SHA, build ID, build time or deployment ID:
`/health/live` → `{status,timestamp}`, `/health` → `{status,timestamp,uptime,checks}`,
`/version` → 404. `package.json` version is `1.0.0`. There is no `.git` in the
container and no `RAILWAY_GIT_COMMIT_SHA`. Railway injects
`RAILWAY_DEPLOYMENT_ID` / `RAILWAY_SNAPSHOT_ID`, but the app never reads or logs them.

**The application cannot prove its own source revision.** Exact provenance was
established only by reading the Railway container file system (read-only
`sha256` of `/app`, excluding `node_modules`/`.next`).

Security observation (value not read): a `RAILWAY_API_TOKEN` variable is present
in the production backend container environment.

## 5. Exact deployed source (Phases 4–5)

| Service | Files hashed in container | Match |
|---|---:|---|
| backend `a51bbc32` | 1,601 | **all 1,601 = live tree at hash time**; 1,594 = frozen snapshot; 7 are post-freeze edits (4 added: `debt-age-report.ts`, `stock-valuation-profit.ts` + their specs; 3 changed: `receivables-risk.detector.ts`, `inventory/routes/reports.routes.ts`, `inventory/services/reports.service.ts`); 465 differ from HEAD. 9 snapshot files absent in prod are `.dockerignore`d (`*.md`, `.gitignore`). |
| web `565d6cab` | 1,605 | **all 1,605 = live tree at hash time**; 32 are post-freeze edits; 508 differ from HEAD. |
| workers `bbbfa37d` | 1,567 | older backend code: 81 files differ from both snapshot and live tree. |

Immutable production archives (read-only, per-file manifests, verified against
the container hashes at copy time):

- `/Users/hazem/Desktop/gates-provenance/production-backend-a51bbc32/` — `source.tar` sha256 `f292ece6…6713`, `MANIFEST-gates-backend.sha256` sha256 `04968037…9a38`, 0 mismatches.
- `/Users/hazem/Desktop/gates-provenance/production-web-565d6cab/` — `source.tar` sha256 `2ad2e1cc…487d`, manifest sha256 `a7fffeab…3ecd`, 0 mismatches.
- `/Users/hazem/Desktop/gates-provenance/production-workers-bbbfa37d/` — `container-app.tar` (tar streamed read-only from the container) sha256 `6e0f635c…dc19d`, 1,567/1,567 files verified.

## 6. The five fixes (Phase 5)

Evidence = discriminating fix lines present in the source hashed inside the
serving backend container (and absent from HEAD). Backend executes that source
directly via `tsx`.

| Fix | Markers checked (all in serving backend, none in HEAD) | Classification |
|---|---|---|
| H-01 | `inventory/utils/claim-document-post.ts` exists; `claimDocumentPost(...)` claims in transfer, adjustment, other-adjustment | **CONFIRMED DEPLOYED** (backend `a51bbc32`) |
| H-03 | `cashTransactionService.updateInTx`, `treasuryPostingService.rewritePostedCashJournalInTx`, `allowPosted: true` | **CONFIRMED DEPLOYED** |
| CC-02 | `const claimUnpost = await tx.invoice.updateMany` in invoice-posting-orchestrator | **CONFIRMED DEPLOYED** |
| CC-03 | `const claimUnpost = await tx.posOrder.updateMany` in pos-order-posting | **CONFIRMED DEPLOYED** |
| CC-06 | `throwStaleWrite` import + `version: invoice.version` in the post claim; `claimCancel` + draft-only `deleteMany` in invoice-m5; `claimCancel` in legacy invoice.service | **CONFIRMED DEPLOYED** |

Caveats:
- The workers deployment (2026-09-24) contains none of the five; a static
  reference check found no worker processor importing the fixed services
  (workers run payroll, reports, PDF, tax-portal sync, report export, proactive
  CFO and automation queues).
- Only the current deployment is proven. Earlier uploads today probably
  carried the fixes too (they were in the tree), but that is timing only.
- Deployed means the dirty-tree versions: fixes ship together with every other
  uncommitted change in those files. The board is not updated by this document.

## 7. Migration provenance (Phase 6)

Read inside the backend container over one connection with
`SET SESSION TRANSACTION READ ONLY` (verified `@@transaction_read_only = 1`),
database `railway`, MySQL 9.7.2. SELECT only.

`_prisma_migrations`: 213 rows, 185 distinct names, all 185 applied (finished,
not rolled back); 28 rolled-back rows from failed attempts; 0 unfinished.
Latest: `20260927150000_company_settings_logo_longtext`, finished
2026-09-27 12:01:31 UTC (15:01:31 +0300).

| Migration set | HEAD | Frozen snapshot | Production applied |
|---|---:|---:|---:|
| count | 177 | 185 | 185 |
| 177 committed migrations | present | present | applied |
| `20260923120000_hr_lookups` | — | present | applied 09-24 13:14 +0300, checksum = snapshot |
| `20260924140000_item_quantity_decimal_18_4` | — | present | applied 09-24 15:49, = |
| `20260924143000_invoice_line_source_and_combo_item` | — | present | applied 09-24 15:49, = |
| `20260924150000_clothing_combo_per_item` | — | present | applied 09-24 15:49, = |
| `20260924160000_company_email_config` | — | present | applied 09-24 16:23, = |
| `20260924170000_whatsapp_embedded_signup` | — | present | applied 09-24 16:43 after 12 rolled-back attempts, = |
| `20260924180000_securities_receipt_endorsee` | — | present | applied 09-24 19:18, = |
| `20260927150000_company_settings_logo_longtext` | — | present | applied 09-27 15:01, = |
| applied but edited afterwards (checksum ≠ file) | 8 | same 8 | — |

Edited-after-apply (same in HEAD and snapshot): `0004_audit_triggers`,
`20250816153000_wave0_m3_m4_party_inventory`, `20260820140000_phase1_ledger_foundations`,
`20260820141500_phase1_reversal_of_journal_entry`, `20260821010000_phase2_landed_cost_allocation`,
`20260824120000_add_item_category_and_invoice_enterprise_fields`,
`20260824121500_invoice_line_traceability_fields`, `20260917200000_securities_entity`.

Why rolled-back rows exist: `scripts/railway-start.mjs` runs
`prisma migrate deploy`, and on failure automatically runs
`prisma migrate resolve --rolled-back` and retries — failed production
migrations are marked resolved without human review.

Production schema is **ahead of HEAD** by 8 migrations and **matches the frozen
snapshot's migration set exactly** (names and checksums of those 8).

## 8. Schema fingerprint (Phase 7)

INFORMATION_SCHEMA (277 tables, 4,202 columns, 1,275 indexes, 671 FK columns)
compared with the table/column sets declared by each `schema.prisma` (static
parse; no database built, no migration run).

| Finding | HEAD | Snapshot |
|---|---|---|
| Prod tables the schema cannot produce | 5 (`company_email_configs`, `hr_attendance_records`, `hr_lookups`, `invoice_line_sources`, `whatsapp_outbound_messages`) | 0 |
| Prod columns the schema cannot produce | 64 (e.g. `company_whatsapp_configs.accessTokenEncrypted/connectionStatus/…`, `allowances.defaultAmount`, `clothing_combos.itemId`) | 0 (only `_prisma_migrations`) |
| Column types | `item_quantities.quantity` declared `Decimal(15,3)`, prod `decimal(18,4)`; `company_settings.logoUrl` prod `longtext` vs HEAD `varchar(191)` | matches |
| Declared but missing in prod | `financial_adjustment_notes`, `financial_adjustment_line_items` (30 columns) | same two (pre-existing drift) |

Production schema corresponds to the frozen snapshot, not HEAD.

## 9. Baseline candidates (Phase 8)

| Candidate | Verdict |
|---|---|
| A. HEAD | Not production: 465 backend + 508 web files differ; 8 migrations behind; narrower column types. |
| B. Frozen snapshot | Very close: backend 1,594/1,601, web 1,573/1,605 identical; migrations identical to prod. Missing post-freeze edits. |
| C. Running production | **Exact and now archived** (backend, web, workers). |
| D. Production schema/migrations | 185 applied, matches snapshot's folder by name; 8 historic migrations edited after apply; 2 declared tables never created. |

- **SOURCE baseline:** the production archives — backend `a51bbc32` + web
  `565d6cab` — with workers `bbbfa37d` recorded as an older, divergent runtime.
- **DATABASE baseline:** production `_prisma_migrations` (185 applied) +
  production INFORMATION_SCHEMA fingerprint. The snapshot/production migration
  folder reproduces the names but not byte-identical history (8 edited files) and
  would create 2 tables production does not have.

## 10. Recovery strategy (Phase 9 — design only)

Goal: verified production source → clean Git baseline → reproducible migrations
→ safe tests → five fixes verified → CI green → known SHA → deploy only from that
SHA → resume remediation.

1. **Pause uploads.** No `railway up` from any working tree until step 7. Other
   sessions keep editing the live tree; their edits stay out of the baseline.
2. **Recovery branch from HEAD** (e.g. `recovery/prod-2026-09-27`). Target state:
   the production backend + web archives. Convergence rule: after the last change
   set, `sha256` of every file equals the production manifests (plus files that
   `.dockerignore` excluded, taken from the snapshot).
3. **Change sets (in order, each a reviewable commit):**
   1. *DB contract:* 8 migrations + `schema.prisma` (verified against prod checksums).
   2. *Build/tooling:* package manifests/lockfiles, tsconfig, eslint, next.config,
      railway/railpack files, `.github`.
   3. *Shared infrastructure:* `src/shared`, `src/workers`, platform (numbering),
      auth, common; web `lib/` + shared `components/`.
   4. *Wave-1 fixes as deployed:* H-01, H-03, CC-02, CC-03, CC-06 files and their
      integration tests (hunks split from unrelated edits where feasible; mixed
      files documented).
   5. *Inventory + invoices* (transfers, price lists, reports, analytical invoices, line source).
   6. *Accounting* (reports, ledgers, parties, delegates).
   7. *HR* (lookups, attendance).
   8. *Automation*, *AI*, *onboarding/company settings*.
   9. *Vertical modules:* real-estate, contracting/extracts, schools, manufacturing,
      electronic invoices, taxes, trade.
   10. *Communication:* WhatsApp, email config.
   11. Matching web pages per area; then unit tests, docs, `.cursor` rules.
   Per change set: backend `tsc` delta recorded, relevant unit tests run.
4. **Convergence check:** byte-compare against the production manifests; tag
   `prod-2026-09-27` only when identical. Production behavior is preserved by
   construction.
5. **Build prerequisites on top of the tag:** fix the 10 `reports.service.ts`
   errors (incl. the `exchangeRate` select); decide GL branchless semantics
   (`HEAD_BASELINE_GAP_AUDIT.md` §4).
6. **Safe tests + CI:** DB-name guard in Jest setup; move CI to a root
   `.github/`; `migrate deploy` from scratch on a disposable DB and diff against
   the production INFORMATION_SCHEMA fingerprint (reveals the 8 edited
   migrations and the 2 missing tables); re-run the five fixes' integration tests.
7. **First controlled deploy:** backend, web and workers from the same SHA
   (workers are currently three days behind). Remove the automatic
   `migrate resolve --rolled-back` from `railway-start.mjs` in a separate reviewed
   change.
8. **Resume remediation** (board queue, CC-22 first); update the board with
   §6's evidence.

## 11. Future provenance requirement (Phase 10 — design only)

Minimum mechanism:

- **Deploy only from a clean, pushed commit.** A deploy script refuses if
  `git status --porcelain` is non-empty or `HEAD` is not on the remote; ideally
  deploy via Railway's Git integration or CI from a tag, never `railway up` from
  a working tree.
- **Build info baked at build time:** `build-info.json` with `gitSha`,
  `gitTreeClean`, `buildTime`, `appVersion`, `service`; generated in the build
  step (backend `railway:build`, web `next build`, workers).
- **Runtime identity:** at startup, log one line with `gitSha`, `buildTime`,
  `appVersion`, `RAILWAY_DEPLOYMENT_ID`, `RAILWAY_SNAPSHOT_ID`,
  `RAILWAY_ENVIRONMENT_NAME`; expose the same non-secret fields on an
  unauthenticated `/health/version` (backend and workers) and a build meta tag or
  endpoint for web.
- **Fail closed in production** if `gitSha` is missing or `gitTreeClean` is false.
- **Deployment ledger:** the deploy script appends `{time, service, sha,
  deploymentId}` to a log kept in the repo or CI artifacts.
- **Lockstep:** backend, web and workers deploy from the same SHA.

## 12. Other findings recorded (not acted on)

- Workers run 2026-09-24 code, older than backend/web.
- Production logged `P2003` failures in `itemCostHistory.upsert` during transfer
  posting at ~15:30 ("Transfer saved; post skipped").
- Three web builds failed today before `565d6cab` succeeded.
- `railway.json` says Nixpacks; the effective builder is Railpack.
- `RAILWAY_API_TOKEN` is present in the backend container environment.
- `HEAD_BASELINE_GAP_AUDIT.md` §7 and the board's "0 deployed" are superseded by
  §3 and §6 here.
