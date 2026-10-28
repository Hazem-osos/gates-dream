---
name: gates-migration-engine
description: >-
  Legacy DB migration wizard (ترحيل قواعد البيانات). Customer path is upload
  .bak on the deployed app, restore on a dedicated SQL Server worker, then the
  existing engine. That restore host is not provisioned yet. Direct SQL and
  Windows SSMS remain operator fallbacks. Use for migration-engine, .bak,
  LEGACY_FORENSIC, database-tools migration page.
---

# Migration engine (operations)

## Safety gates

- `MIGRATION_ENGINE_ENABLED=true` required.
- Production MySQL (Railway host) blocked unless `MIGRATION_ALLOW_PRODUCTION_TARGET=true` (owner cutover only).
- Legacy source read-only — never `MIGRATION_LEGACY_WRITABLE=true`.

## Customer path (cloud `.bak`)

The product path is: deployed wizard → upload `.bak` → bak-restore worker → dedicated SQL Server → existing engine (`BACKUP_RESTORE` config). The customer does not install SSMS.

The image that can restore is `gates-backend/Dockerfile.restore-sql` (SQL Server and the worker on one disk). A separate worker cannot `RESTORE FROM DISK` on Railway. See `docs/migration/RESTORE_BLOCKER_AUDIT.md`. Developer edition is not for customer production data.

## Operator fallback (not the customer path)

Windows SSMS restore + local `MIGRATION_RUN_INLINE` backend can still read a database you already restored. It is not a substitute for the cloud restore worker.

## Railway checklist (after the SQL service exists)

Set on **gates-backend** and **gates-workers**:

- `MIGRATION_ENGINE_ENABLED`, `MIGRATION_ALLOW_PRODUCTION_TARGET` (if intentional)
- Wizard REMOTE_SQL READY (or `LEGACY_FORENSIC_URL` if SQL is reachable from Railway)
- `MIGRATION_PACKAGES_DIR` + volume mount for `.bak` **uploads only**
- `REDIS_ENABLED` + workers for queued runs

## One-click operator path

`POST /migration-engine/jobs/:id/run` `{ mode: 'auto', confirmTargetWrite: true }` runs **analyze → dry-run → execute** under one coordinator lock.

- Create-job alone stays `DRAFT` / 0% — that is idle, not a running cutover.
- After `/run`, persist `ui.lastEnqueuedAt` (and clear `ui.lastError`). Wizard shows **في الانتظار** until analyze starts; `ui.lastError` after worker/inline failure.
- Do **not** send `execute` on a `DRAFT` job — `canRunExecute` only allows READY/RUNNING/COMPLETED/PAUSED. Use `auto`.
- Stage `acquireLock` must **reuse** the worker lock (`acquireLockOrReuse`); a second token throws «locked by another runner».
- Inline (`MIGRATION_RUN_INLINE`) and queued paths both require `confirmTargetWrite` for `auto`/`execute`.
- Railway MySQL (`rlwy.net`, `*.railway.internal`) is blocked as a target. `MIGRATION_ALLOW_PRODUCTION_TARGET=true` opens it — **owner cutover gate only**, never a standing setting, never for tests. Same `ENCRYPTION_KEY` on backend + workers.

## Windows Migration Agent packaging

The customer Windows exe is `gates-migration-connector` packed with pinned `@yao-pkg/pkg` **6.24.0**.

- Do **not** use `--targets node20-win-x64`. pkg-fetch **3.6.x dropped Node 20 prebuilts**, so that target 404s as `node-v20.20.2-win-x64` and then fails to compile a Windows Node binary on macOS/Linux.
- Supported target: `node22-win-x64` (v3.6 cache publishes `node-v22.*-win-x64`).
- Always pass `--no-bytecode --public --public-packages "*"`. Without that, pkg tries to spawn the Windows Node binary to compile bytecode and fails on macOS (`spawn Unknown system error -86`). `--public-packages "*"` is required so node_modules are packed as source, not bytecode.
- Pin `@yao-pkg/pkg` in `gates-migration-connector/package.json`. Do not `npx --yes @yao-pkg/pkg` (unpinned latest).
- GitHub Actions: `.github/workflows/migration-agent-windows.yml` — `npm ci`, `tsc`, pack, `GatesMigrationAgent.exe --self-test`, SHA-256, private artifact `GatesMigrationAgent-0.2.3`. The job must fail if the exe is missing or `--self-test` does not print `self-test ok`. The version smoke must match `0.2.3`.
- Do not publish the unsigned artifact to customers. Do not change the ten-stage engine to “make packaging work”.
- Windows smoke + first local restore: `gates-migration-connector/WINDOWS_TEST_GUIDE.md`, `SYNTHETIC_SQL_TEST.sql`, `LOCAL_RESTORE_TEST.md`. Unique names `GatesSyntheticSrc` / `GatesAgentRestore_GSyn251025T1`. Never `sa`, never `REPLACE`, never production. Do not claim Windows or RESTORE passed until those machines produce captured output.
- Agent local restore (`local-restore-plan.ts`): `RESTORE FILELISTONLY`, unique destinations under `InstanceDefaultDataPath` / `InstanceDefaultLogPath`, `RESTORE ... WITH MOVE` for every logical file (data, log, FILESTREAM, full-text). Reject existing dest DB or `sys.master_files` path collision. Never `REPLACE`, never `DROP` the source. Tests: `gates-backend/src/__tests__/unit/agent-local-restore.spec.ts`.
- Existing customer DB: agent **mode 1** + `db_datareader` login (not `sa`). Connect retries encrypt off then TDS 7.2 (SQL 2008). Do not install a second SQL Server unless `@@VERSION` is older than 2008. Do not pair/`auto` against Railway production MySQL. Launch card: `gates-migration-connector/WINDOWS_PC.md`. EXE version **0.2.3**.
- Packed EXE must statically import `startConnectorLoop` from `connector-loop.ts` (never dynamic `import('./index.js')`). pkg ESM left `C:\snapshot\...\dist\index.js` missing. Pack via `tsconfig.pack.json` (CommonJS `dist-cjs`) then `pkg dist-cjs/agent.js --no-bytecode --public --public-packages "*"`. After pack, the EXE must contain the string `Gates sends analyze commands here`.
- Dry-run pipeline: each stage ends `READY`, then the next stage goes `DRY_RUNNING`. `READY → DRY_RUNNING` must be legal or workers throw `MigrationStateMachineError` and the job shows FAILED with lifecycle still `ANALYZED`, 0 blockers, and no material recon.
- User **إيقاف التشغيل** (`POST /jobs/:id/rollback`) must abort mid-run: `cancelRequestedAt`, fail pending connector commands, force-unlock, remove Bull jobs, `DRY_RUNNING|RUNNING|ANALYZING → FAILED`. Then analyze/dry-run work again. Do not leave the job locked at ~32% (ACCOUNTING). Pause is `DRY_RUNNING → PAUSED`; abort is the full stop.
- Results step must not trap the user: auto-open results only once; **رجوع للتشغيل** returns to step 2. Do not bounce `FAILED` back to results on every render.
- `InvoiceTrxHeader` catalog columns only in `invoiceHeaderSelectSql`. SQL Server fails `COALESCE` of a missing physical column even when the fallback exists. Do **not** select `NetValue`, `TotalValue`, `DiscountValue`, `DaribaValue`, `RemainingValue`, `CustomerCode`, `SupplierCode`. Map `NetAmount`/`TotalAmount`/`SalesDaribaAmount`/`OfferAmount`/`SupplierAccountCode`; remaining is `NetAmount − PaidAmount`. Same rule for `CashTrxHeader` (`cashHeaderSelectSql`): `AccountNo`/`Amount`/`CashNum` — no `TrxNum`/`CustomerCode`/`Value`.
- Create job uses `skipSourceProbe` + `connector:` provisional fingerprint. Analyze still needs the window open and `Connected to legacy SQL Server`. `assertFingerprint` must treat `connector:` / `package:` / `pending` as provisional and **commit** the real hash. If workers are stale, analyze throws `Source fingerprint mismatch` (`Expected connector:…, got <sha>`). Deploy **gates-workers** with the same backend tree — queued `/run` does not use the API process.
- After SQL answers the agent must print `Connected` and stay open. If it still closes, run from PowerShell (not double-click) and read the last line. Do not tell users to bypass SmartScreen.
- Production execute stays off (`MIGRATION_CUSTOMER_EXECUTE_ENABLED=false`). Wizard step 2 should show **تحليل المصدر** as the primary button, not «ترحيل الآن». The Arabic «تنفيذ الترحيل غير مفعّل على هذه البيئة» is expected.
- Wizard download: `GET /migration-engine/agent/release` + owner `GET /migration-engine/agent/download` from `internal-releases/migration-agent/` (unsigned `channel: internal-testing`). Execute/auto blocked unless `MIGRATION_CUSTOMER_EXECUTE_ENABLED=true` (optional `MIGRATION_INTERNAL_TEST_USER_IDS`). Never enable that flag against production MySQL.
- Connector `pair` / `poll` / `complete` must skip the global `/api/v1` JWT gate (`isPublicMigrationAgentPath`). Otherwise the EXE prints Authentication required and exits before Mode.
- Existing Railway project `invigorating-exploration` is the live site. Backend `railway up` must pass `--no-gitignore` or the EXE is omitted. Keep `MIGRATION_CUSTOMER_EXECUTE_ENABLED=false` on production.

## Data correctness rules (verified locally 2026-10-28, 16/16 independent checks)

Full write-up: `docs/migration/LOCAL_E2E_RESULTS_2026-10-27.md`. Do not regress these:

- Wizard sends `mode: 'import'` (the shared sanitizer rejects the word `execute` in any body); the schema maps it to `execute`. Do not weaken the sanitizer.
- Dry-run must call `ctx.idMap.planMapping(...)` wherever it skips a write, so later dry-run stages resolve planned journals / accounts / items. Never write in dry-run.
- Legacy numbers repeat per branch, year and type. Target keys: invoices `invoice-number-plan.ts` (prefix the type only on collision), cheques `cheque-number-plan.ts`, cash matched by branch + journal. Never match an existing target row on number alone.
- `InvoiceTrxHeader.SupplierAccountCode` is the party's **account**; resolve with `migration-party-ref.service.ts` (sales → customer, purchases → supplier). Never set both.
- Invoice lines: `UnitCode2`/`Qty2` = base unit; the priced pair is the one whose qty × Price = TotalValue (`invoice-line-units.ts`). `InvoiceTrxDetail` has no `LineNum` column.
- Map a document only after all its lines are written (resume safety). Each `CashTrxDetail` line owns its own `PaymentAllocation`.
- Items: every non-group item migrates (deleted → inactive). Stock sign covers SI01/SI02/PI02. StoreAdjust supersedes the StoreCheck count with the same `StoreCheckCode`.
- Journal lines on a party's own account carry `partnerId`/`partnerType`. After import, ledger caches are rebuilt from GL (`migration-ledger-cache.service.ts`); rollback rebuilds them before deleting accounts (FK restrict).
- Caches are rebuilt with the shared `rebuildCompanyBalances` (its BigInt period-sort crash was fixed 2026-10-28; test `ledger-balance-rebuild-bigint.spec.ts`).
- Analyze runs `migration-preflight.service.ts` (Arabic ADD / FIX / IGNORE list); reconciliation blocks on any `completeness` gap or party balance mismatch.
- Rollback runs in the background (`progress.rollback`); `FAILED → ROLLED_BACK` is legal.
- Prove any engine change with `gates-backend/scripts/migration/synthetic-e2e/` (`prepare.sh`, then `full-run.sh`; expect `16/16 checks match` and `IDEMPOTENT`). Local disposable containers only.

## Agent workflow

1. UI: `gates-web/app/accounting-settings/database-tools/database-migration/page.tsx`
2. Capabilities: `GET /migration-engine/capabilities` → `explainMigrationEngineAlert` (web).
3. Run job: `POST /migration-engine/jobs/:id/run` — `auto` for operator; inline vs BullMQ per env.
4. Docs: `docs/migration/RAILWAY_MIGRATION_ENV.md`, `docs/migration/CUTOVER_RUNBOOK.md`.

## User-facing errors

Map English backend messages via `gates-web/lib/migration/capability-messages.ts` and `localize-api-error-message.ts` (Migration engine / Target DATABASE_URL patterns).

Wizard toasts (ترحيل / .bak / النتيجة / اختبار الاتصال):

- Page handles errors locally (`skipErrorNotify`) — do **not** also broadcast, or the user sees two stacked toasts (specific + generic «تعذّر تنفيذ العملية»).
- Exclude `/migration-engine` from `isBusinessSupportError` so AiErrorModal does not stack on the same 400.
- Host field: split `host,1433` / `host:1433` in UI and `normalizeRemoteSqlHostPort` on save/test. Placeholder must not teach packing port into Host.
- DNS `ENOTFOUND` of a **clean** hostname is **not** a host,port typo — say Railway cannot see office LAN; use public IP, on-premise connector, or restore `.bak` on reachable SQL.
- `BACKUP_RESTORE` without READY restore throws Isolated SQL / bak-disabled (honest Arabic), never falls through to `LEGACY_FORENSIC_URL` or generic English.
- Disable **ترحيل الآن** until the source is READY (`legacyRemoteSqlStatus` / forensic / selected package).
- Agent window closed after SQL: 0.2.1 did not await the loop; 0.2.2 awaited a **dynamic** import that pkg resolved as missing `C:\snapshot\...\dist\index.js`. Fix is 0.2.3 static import + `pkg.assets`. User must re-download, keep the window open, then **تحليل** (not «ترحيل الآن» on production).

Owner-only mutations: `assertOwnerOnly` on job create/run.

## Readiness (2026-10-28)

Status, supported / blocked document types, rollback limits, staging prerequisites and the
production go / no-go checklist: `docs/migration/LOCAL_E2E_RESULTS_2026-10-27.md` → "Release
readiness review". Fresh empty database bootstrap: `docs/migration/PRISMA_FRESH_INSTALL_BASELINE.md`
(the historical migration chain does not build an empty MySQL). Invoice types outside the
SI / SV / PI / SR / PR families are BLOCKED, never guessed.
