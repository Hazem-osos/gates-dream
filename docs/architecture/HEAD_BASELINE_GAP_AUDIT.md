# HEAD Baseline Gap Audit — 2026-09-27

Read-only diagnosis of why pristine HEAD has 46 TypeScript errors while the dirty
working tree has 10. No source, test, schema, migration, config, package or Git
state was modified. This file is the only artifact.

Related: `REMEDIATION_BOARD.md`, `WORKTREE_INVENTORY_2026-09-27.md`,
`ENGINEERING_CONSTITUTION.md`.

---

## 0. Method

| State | Location | How measured |
|---|---|---|
| A. Pristine HEAD `45fd5bee…` | `/Users/hazem/Desktop/gates-head-baseline` (detached worktree, `npm ci` from HEAD lockfile, `prisma generate` from HEAD schema) | `tsc --noEmit` |
| B. Dirty working tree | `/Users/hazem/Desktop/gates web` | `tsc --noEmit` (tsconfig has no `incremental`, writes nothing) |
| C. CC-03 rehearsal | `/Users/hazem/Desktop/gates-cc03-rehearsal` (HEAD + CC-03 service + CC-03 test) | `tsc --noEmit` |

Attribution of each disappearance was done by reading the dirty diff
(`git diff --ignore-cr-at-eol`) of the erroring file **and** of the callee whose
signature the error names, then reading the runtime use of the value at HEAD.
Local DB facts come from read-only aggregate `SELECT`s against local MySQL
`localhost:3306` (`gates_db` dev copy, `gates_h01_test`), inside
`START TRANSACTION READ ONLY`.

## 1. Three states

| State | tsc errors | Notes |
|---|---:|---|
| A. HEAD | **46** | 25 files. None are generated-client/schema mismatches. |
| B. Dirty tree | **10** | All 10 in `accounting/services/reports.service.ts`; **none of them exist at HEAD**. All 46 HEAD errors are gone. |
| C. CC-03 rehearsal | **46** | Identical to A by file + error code. CC-03 adds 0. POS error at HEAD line 415 = rehearsal line 425 (shifted by the claim). |

So the gap is **−46 +10**, not "36 fewer".

HEAD has not type-checked cleanly since at least 2026-09-15..17 (see origins
below). This never blocked production because:

- backend Railway build is `railway:build = prisma generate` (no `tsc`);
- the CI workflow lives in `gates-backend/.github/workflows/test.yml`, not in a
  root `.github/`, so GitHub never runs it;
- the web build (`next build`, `ignoreBuildErrors: false`) type-checks only the
  web app.

## 2. Root-cause groups (HEAD's 46)

### RC-1 — GL numbering signature narrower than the posting context (18)

- Origin: commit `4e0ae91` (2026-09-17, "Give securities paper journals a GL
  serial and paper source") widened `JournalPostingContext.branchId` from
  `string` to `branchId?: string | null` and adapted its own calls with
  `optionalBranchId(ctx.branchId) ?? ''`, but did **not** widen
  `documentSequenceService.nextGlNumber(InTx)(ctx: { branchId: string })`.
- Every service that passes a `JournalPostingContext` (or `{...ctx, fiscalYearId}`)
  straight into GL numbering broke: TS2345 ×18.
- Files: contracting (client-billing-accounting, lg-accounting, client-extract,
  contracting-posting, subcontractor-extract), hr/payroll-posting,
  manufacturing-costing, pos-order-posting:132, pos-shift:104,
  real-estate-accounting, unit-contract:23, tuition-billing:39,
  subcontract-accounting, tax-declaration-posting, letter-of-credit:59,
  letter-of-guarantee, treasury/cheque-lifecycle, treasury/treasury-posting.
- Removed in B by: `platform/services/document-sequence.service.ts` (+4/−4):
  ctx type → `branchId?: string | null` **and** `branchId: ctx.branchId ?? null`.

### RC-2 — Same `4e0ae91` widening propagated to other `branchId: string` consumers (21)

| Sub-group | Errors | Callee (narrow type at HEAD) | Removed in B by |
|---|---:|---|---|
| RC-2a stock movement | 8 | `PostStockMovementInput.branchId?: string` | `inventory/services/stock-movement.service.ts` 1-line widening (pos-order-posting 192/415, production-order ×4, letter-of-credit ×2) |
| RC-2b cash voucher create | 4 | `cashTransactionService.create(…, branchId: string \| undefined, …)` | `treasury/services/cash-transaction.service.ts` signature widening (demo ×2, unit-contract:278, tuition-billing:240) |
| RC-2c invoice create | 3 | `invoiceM5Service.create(…, branchId: string \| undefined, …)` | `invoices/services/invoice-m5.service.ts` signature widening (demo ×3) |
| RC-2d client-billing command | 1 | `lockAndPostClientInvoice(…, branchId: string)` | `contracting/client-billing/services/client-invoice-command.service.ts` widening (client-billing.routes:173) |
| RC-2e demo seeding callers | 5 | journal-entry create/post ctx, `createIssue`, `createReceipt`, `createTransfer` (`branchId?: string`) | caller-side `?? undefined` in `demo/hazem-demo-transactions.ts` |

### RC-3 — `paymentSplits` optional vs required (3)

- invoice-m5:98, invoice-settlement-split:241, :260. The split service declared
  `paymentSplits: unknown` and called `input.paymentSplits.filter(...)`.
- Removed in B by `invoice-settlement-split.service.ts`: `paymentSplits?: unknown`
  + `const splits = input.paymentSplits ?? []`. At HEAD an absent value would
  throw `TypeError` at runtime → latent crash guard, not a pure annotation.

### RC-4 — invoice line `unitId` optional vs required (2)

- invoice-m5:566, :902 (`unitId: string | undefined` into a required column).
- Removed in B by a **new runtime guard** in `toLineRow`:
  `if (!line.unitId) throw new AppError(422, 'وحدة الصنف مطلوبة')` — turns a
  Prisma failure into a new 422. Same file hunk set also adds
  `SALES_ORDER`, item offers, contract payment terms and
  `recordInvoiceLineSource` (untracked services; depends on the
  `InvoiceLineSource` model that exists only in the dirty `schema.prisma` and
  untracked migration `20260924143000_invoice_line_source_and_combo_item`).

### RC-5 — cash voucher list `options` possibly undefined (1)

- cash-transaction:743, introduced `2afd82d` (2026-09-15). The last ternary arm
  dereferences `options.sortDir`; with no `options` it throws at runtime.
- Removed in B by `options?.sortDir` inside a +205/−191 file that also carries
  CC-02 and an overdraft-amount change (see §3).

### RC-6 — document-layout upsert body typed `{}` (1)

- document-layout.routes:151, introduced `531390e` (2026-09-15).
- Removed in B by a cast `req.body as { id?: string } & Parameters<typeof documentLayoutService.upsert>[1]`
  (no runtime change; body is still unvalidated before and after), bundled with
  Arabic-message edits in the same file.

### RC-D1 — dirty-tree-only (10, not at HEAD)

- `accounting/services/reports.service.ts` (+1784/−1018, last touched 09-24 19:53,
  owner unknown).
- 8× `stampCreatedBy(where, filters)` where `ReportFilters` has no `userId`
  (TS2559/TS2345; runtime still works because extra query props pass through).
- 2× `sr.exchangeRate` read from a `select` that does not include it → always
  `undefined → 1`. **Possible FX reporting bug** in any environment running this
  file (recorded, not designed).

Total: 18 + 21 + 3 + 2 + 1 + 1 = **46**.

## 3. Classification of each responsible dirty-tree change

Legend: A type-only · B runtime/business · C schema/generated-client ·
D API contract (incl. error text) · E unrelated feature work · F formatting/EOL ·
G unknown.

| Change (dirty tree) | Hunk that removes the error | Other hunks in the same file | Class of the needed hunk | Class of the whole file diff |
|---|---|---|---|---|
| `document-sequence.service.ts` | ctx widening + `?? null` | none | **B (latent)** — see §4 | B |
| `stock-movement.service.ts` | `branchId?: string \| null` | negative-stock policy rewrite (legacy flags ignored when settings exist; flags read inside tx), new `lockWarehouseBalanceInTx` (needs modified `adjust-stock-in-tx.ts`) | **A** | A + B + dependency |
| `cash-transaction.service.ts` | `branchId/fiscalYearId: string \| null \| undefined`; `options?.sortDir` | CC-02, overdraft check now uses FX/line-based `needed`, many others; EOL churn | A (runtime: `branchId ?? null` for numbering, nullable columns) | A + B + CC-02 |
| `invoice-m5.service.ts` | create signature widening (RC-2c) | CC-06, RC-4 guard, SALES_ORDER, offers, contract terms, line source | RC-2c: A · RC-4: **B** | A + B + C + E + CC-06 |
| `client-invoice-command.service.ts`, `client-billing-accounting.service.ts` | `branchId?: string \| null` | — | A (value flows only into `JournalPostingContext`) | A |
| `demo/hazem-demo-transactions.ts` | caller `?? undefined` | — | A | A |
| `invoice-settlement-split.service.ts` | optional + `?? []` | error messages translated to Arabic | A (+ crash guard) | A + D |
| `document-layout.routes.ts` | body cast | error messages translated to Arabic | A | A + D |
| `production-order.service.ts` | caller `?? undefined` (also fixed by stock widening) | **completion rule changed** (labor/overhead journal now required only when labor/overhead > 0) + Arabic message | A | A + B + D |
| `client-billing.routes.ts`, `cheque-lifecycle.service.ts`, `unit-contract.service.ts` | none needed (fixed by callee) | Arabic message translations only | — | D |

No disappearance is explained by formatting/EOL alone (F), and none by a
generated-client/schema mismatch at HEAD (all 46 compile against HEAD's own
client). Only RC-4's *removal path* is entangled with schema (C).

## 4. `branchId` deep check

### 4.1 GL numbering (`nextGlNumberInTx` / `nextGlNumber`)

Storage: `document_sequences` — `branchId String?`, FK → `branches.id`
(ON DELETE CASCADE), `@@unique([companyId, branchId, fiscalYearId, docType])`.

Allocator (`nextNumberInTx`, unchanged between HEAD and dirty):
`findFirst({ where: { companyId, branchId, fiscalYearId, docType } })`, create
on miss, then `SELECT … WHERE id = ? FOR UPDATE`. P2002 fallback uses NULL-safe
`<=>`.

What each value means **at runtime today (HEAD)**:

| Value reaching the allocator | Prisma meaning | Effect |
|---|---|---|
| real branch id | `branchId = ?` | per-branch sequence (43 of 46 GL rows in `gates_db`) |
| `null` | `branchId IS NULL` | company-level (branchless) sequence. Exists intentionally: 3 null-branch GL rows in `gates_db` across 3 companies; allocator explicitly handles NULL. |
| `undefined` | **filter omitted** | `findFirst` matches *any* branch's row (or the NULL row) for that company/year/docType — arbitrary sharing. If none exists, create writes NULL. |
| `''` | `branchId = ''` | never matches; create fails the FK → posting fails closed |

Who passes what at HEAD:

- `''` when branch is absent: `journal-posting.service` (manual/auto journals,
  both paths), `auto-gl-posting.service`, `stock-movement-gl.service`,
  `invoice-posting-orchestrator`. A branchless post on these paths fails.
- raw `ctx` (RC-1's 18 callers): contexts come from
  `journalEntryService.buildPostingContext` (throws 400 without branch),
  `buildPosPostingContext` / `buildTreasuryPostingContext` /
  `buildInvoicePostingContext` (all throw without branch). So in route-driven
  flows a real branch id always arrives. Non-route constructions exist
  (`batch-operations` POS ctx, `{...ctx, fiscalYearId}` spreads) but derive from
  the same guaranteed contexts.
- `null` explicitly: `counterparty-offset.service` (`params.branchId ?? null`,
  via `nextNumber`).
- Oddity recorded: `buildStockGlPostingContext` uses `req.branchId ?? companyId`.

Isolation risk of the dirty widening: `ctx.branchId ?? null` converts the
`undefined` case from "any branch's row" to "the company NULL row". In
`gates_db` one company/fiscal year already has both branch rows and a NULL GL row,
so for an `undefined` caller the chosen stream can change. GL numbering does not
pass `seedFromExisting`/`isAvailable`, so a newly created NULL row starts at
`startNumber` and could collide with numbers already issued from a branch row.
Separately, MySQL treats NULLs as distinct in the unique key, so the key does not
protect NULL-branch / NULL-year rows against duplicate first-creation (no
duplicates found locally: 0 duplicate NULL-safe keys in both DBs).

**Conclusion:** widening the *type* is harmless for route callers (real ids), but
the `?? null` coercion changes semantics for `undefined` and makes the GL
branch-less meaning a product decision ("company-level sequence" vs "fail").

### 4.2 Stock movements (`PostStockMovementInput.branchId`)

- Only runtime use in `postMovementInTx`: `tx.inventoryMovement.create({ data: { branchId: input.branchId, … } })`.
  `inventory_movements.branchId` is `String?` (FK ON DELETE SET NULL). Prisma
  writes NULL for both `null` and `undefined`. No filter, lock key, costing,
  journal or warehouse-ownership logic reads it inside the service.
- Callers passing null-able branch coerced to `undefined` (proves branchless
  movements are intended): issue, disassembly, stocktaking, purchase-return,
  other-adjustment, opening-stock, assembly, invoice-posting-orchestrator.
- Callers passing `ctx.branchId` typed `string | null | undefined`:
  pos-order-posting (always real id at runtime), production-order,
  letter-of-credit.
- Callers guaranteeing a branch: POS (context builder throws), anything built via
  `buildPostingContext`.
- Data: `gates_h01_test` has 13 NULL-branch movements (of 925); `gates_db` 0/173.
- Reporting: branch-filtered reports already exclude NULL-branch movements; that
  is identical for `null` and `undefined`.

**Conclusion:** null is already accepted at runtime and stored identically; the
type is merely narrower than reality.

## 5. Prerequisite vs fix

| Change | Verdict | Why |
|---|---|---|
| `PostStockMovementInput.branchId?: string \| null` (the one line only) | **TYPE CONTRACT CORRECTION** | DB nullable, runtime stores null ≡ undefined, callers already legitimately produce null. Zero runtime change. Must be isolated from the rest of the file's diff (policy rewrite + new lock). |
| `nextGlNumber(InTx)` ctx widening + `?? null` | **BUSINESS BEHAVIOR CHANGE** (latent) | Type widening alone would describe reality for route callers, but the coercion changes `undefined` from "unfiltered, any branch" to "company NULL sequence" and interacts with the `''` fail-closed convention used by the other half of the GL callers. Needs a decision on branchless GL semantics. |

## 6. Root-cause table

| Root cause | Affected files | Errors | Dirty change responsible | Class | Needed for CC-03? | Needed for existing prod behavior? | Safe standalone prerequisite? | Product decision? |
|---|---|---:|---|---|---|---|---|---|
| RC-1 GL signature | 18 service files (§2) | 18 | document-sequence widening + `?? null` | B (latent) | **Yes** (pos-order-posting:132) | No (route callers pass real ids) | No, not as-is | **Yes** (branchless GL meaning) |
| RC-2a stock input | pos-order-posting, production-order, letter-of-credit | 8 | 1 line in stock-movement.service | A | **Yes** (192, 415) | No | **Yes** (that line only) | No |
| RC-2b cash create sig | demo, unit-contract, tuition-billing | 4 | cash-transaction signature hunk | A | No | No | Yes (hunk only; file carries CC-02 + B) | No |
| RC-2c invoice create sig | demo | 3 | invoice-m5 signature hunk | A | No | No | Yes (hunk only; file carries CC-06 + B/C/E) | No |
| RC-2d client-billing cmd | client-billing.routes | 1 | client-invoice-command widening | A | No | No | Yes | No |
| RC-2e demo callers | demo | 5 | caller `?? undefined` | A | No | No | Yes | No |
| RC-3 paymentSplits | invoice-m5, invoice-settlement-split | 3 | split service optional + `?? []` | A (+crash guard) | No | Removes a latent crash | Yes (hunk only; file carries D) | No |
| RC-4 unitId | invoice-m5 | 2 | new 422 guard in `toLineRow` | B, entangled C/E | No | Changes error contract | No | Minor (422 text/semantics) |
| RC-5 options | cash-transaction | 1 | `options?.sortDir` | A (+crash guard) | No | Removes a latent crash | Yes (hunk only) | No |
| RC-6 layout body | document-layout.routes | 1 | body cast | A | No | No | Yes (hunk only) | No |
| RC-D1 (dirty only) | reports.service | +10 | — (introduced by dirty feature work) | E | No | FX rate forced to 1 | n/a | Needs owner |

**HEAD verdict: 4 — a mixture.** HEAD is not fundamentally broken at runtime
(most errors are type-contract drift from one commit), but it is (a) behind
legitimate uncommitted type corrections, (b) internally inconsistent about
branchless GL numbering, (c) missing schema state that production already has
(§7), and (d) not the source production runs.

## 7. Production provenance (local evidence only)

What exists:

- `gates-backend/railway.json` / `gates-web/railway.json` (NIXPACKS,
  start `node scripts/railway-start.mjs`), `nixpacks.toml` (Node 20,
  `npm ci --include=dev`, backend build = `prisma generate`). `.dockerignore`
  excludes `.git`. No `.railway/` link dir in the repo. No code reads
  `RAILWAY_GIT_COMMIT_SHA` or exposes a build SHA/version → **deployed builds
  carry no source identifier.**
- Git: local `main` is **ahead of `origin/main` by 4** (`origin/main` =
  `3e6313b`, 2026-09-22). HEAD `45fd5be` was never pushed.
- Deploys are `railway up <dir> --path-as-root` uploads of the working
  directory (not Git-triggered). Agent transcripts record the commands; tool
  *results* are not stored locally:
  - 2026-09-13 … 09-24: repeated backend/web uploads (sessions f552104d,
    bdaa63eb, cd4abe67, 4728b2da, b140ae78 — e.g. deployment `fe62b27b…` SUCCESS —,
    f1eef1ac).
  - **2026-09-27 ~15:00–15:23** (session 90e99a10): `railway up .` backend + web,
    then logs checked for the `logo_longtext` migration; assistant reports "both
    deployed, migration applied". Again backend at ~15:23–15:36.
  - **2026-09-27 ~16:00–16:24** (session aa8bbe7e): `railway up .` backend
    ("stock transfer, price lists, and reports") then web, `--detach`; outcome not
    recorded locally.
- `railway-start.mjs` runs `prisma migrate deploy` on boot, and the uploads
  include untracked migrations → production DB very likely has migrations that
  HEAD does not (HEAD's last: `20260922180000`; dirty adds 8, through
  `20260927150000_company_settings_logo_longtext`).
- The five local fixes (H-01, H-03, CC-02, CC-03, CC-06) were in the dirty tree
  before 15:00 → **they were very likely uploaded to production today.** The
  board's "0 deployed" is therefore probably stale (not edited by this audit).
- Drift since the last recorded upload: 46 working-tree files modified after
  16:00 (44 outside `docs/`/`.cursor/`, still changing at 17:10 by other sessions).
  Earlier content of those files is not recoverable from Git.

What cannot be established locally: the exact deployed source bytes, whether the
16:00 uploads succeeded, and which migrations production has applied.

| Source | Reconstructable locally? |
|---|---|
| Production source | **No.** Only approximable as "dirty tree at ~16:00 minus the 44 later edits"; exact bytes need the running container's `/app` or Railway deployment metadata (requires explicit approval). |
| HEAD | Yes, exactly (`45fd5be`). Not what production runs. |
| Current dirty tree | Yes, as of now, but mutating; not snapshotted. |

## 8. Strategy evaluation

| Strategy | Evidence for | Evidence against | Verdict |
|---|---|---|---|
| A. HEAD + prerequisites one by one | Exact, reproducible start | HEAD never ran in production as-is; behind prod schema by up to 8 migrations; prerequisites are entangled with business changes in most files; would produce a codebase no environment has run | Not recommended as the primary baseline |
| B. Stabilization branch from HEAD, only verified type/build fixes | Clean review surface | Same as A; also RC-1 cannot be resolved without a product decision; still diverges from production | Viable only for isolated proofs (like the CC-03 rehearsal) |
| C. Recover the deployed source revision, stabilize from it | Matches what users actually run; includes schema state and (likely) the five fixes | Not recoverable locally; needs read-only access to Railway (deployment list / container source) with approval | **Recommended target** |
| D. Clean the dirty tree into commits | Closest local approximation of production; nothing lost | Tree is still mutating; 733 unknown-ownership paths; 10 tsc errors; mixed concerns per file | **Recommended mechanism**, anchored to C |

Recommendation: **C, executed through D.** Freeze the dirty tree as evidence,
verify what production actually runs, then turn that verified snapshot into the
baseline commit and stabilize forward. Never discard the dirty tree.

## 9. Smallest stabilization sequence (not executed)

| # | State | Exact files | Reason | Runtime change? | Test required | Before CC-03? |
|---|---|---|---|---|---|---|
| 0 | Freeze evidence | none in repo — out-of-repo archive of the working tree + `git diff` + untracked manifest + sha256, taken while other sessions are paused | Tree is mutating; it is the only local copy of production-like source | No | none | Yes |
| 1 | Verify production (approval needed) | none — read-only `railway deployment list` for backend/web/workers, and optionally read-only copy of `/app` from the running container; read-only `_prisma_migrations` list | Establish exact deployed source + applied migrations; confirm whether the five fixes are live | No | none | Yes |
| 2 | Known source baseline | the verified production snapshot, committed as-is on a new branch (approval needed) | Reproducible baseline = what runs | No (by definition) | full unit suite + migrate-from-scratch on a test DB | Yes |
| 3 | Build prerequisite | `accounting/services/reports.service.ts` (RC-D1: `stampCreatedBy` filter type; `exchangeRate` select) | Baseline to 0 tsc errors so ts-jest can compile every suite | Yes for FX rate (fix of a probable bug) — needs owner sign-off | reports unit tests + FX statement test | Yes |
| 4 | Safe test infrastructure | `src/__tests__/setup.ts` (refuse unless DB name contains `test`, before any import that builds a Prisma client), CI workflow moved to a root `.github/` | Board T-xx items; DB safety must not depend on per-file guards | No (test-only) | guard negative control | Yes |
| 5 | CC-03 | if in baseline: verification only (`pos-order-unpost-concurrency.test.ts` ×3); if not: the +11/−6 service change + test | Five fixes are likely already deployed; prove, don't re-apply | Only if not deployed | 5/5 ×3 on test DB | — |
| 6 | CC-02 / CC-06 | same rule (verify or apply) | — | same | existing wave tests | — |
| 7 | H-01, H-03 | same rule | — | same | existing wave tests | — |
| 8 | GL branchless decision | `document-sequence.service.ts` and the `''` callers | RC-1 semantics (company sequence vs fail) | Yes, deliberate | numbering isolation test per branch/NULL | No |
| 9 | Remaining remediation | per board queue (CC-22 first) | — | — | — | No |

If a HEAD-based proof is still wanted (Strategy B, e.g. to re-run the CC-03
rehearsal), the only prerequisite verified as a pure type contract correction is
the one-line `PostStockMovementInput.branchId?: string | null`. It clears RC-2a
(8 errors, 2 of CC-03's 3 blockers). The third blocker (RC-1) has no
behavior-neutral dirty-tree fix; a POS-local alternative is narrowing
`PosPostingContext` to require `branchId: string` (all POS builders already
guarantee it), which additionally needs a guard in `batch-operations.service.ts`.
That alternative is not in the dirty tree and was not designed further.

## 10. Recorded, not designed

- RC-2e / RC-2b demo errors live in `demo/hazem-demo-transactions.ts` (seed tool).
- `buildStockGlPostingContext` falls back to `companyId` as a branch id.
- `document_sequences` unique key does not protect NULL-branch/NULL-year rows.
- RC-4's 422 message and RC-3/RC-5 crash guards are behavior-visible.
- Many dirty files translate English error messages to Arabic (API text change);
  tests asserting English messages would need review when committing.
