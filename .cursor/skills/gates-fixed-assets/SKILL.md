---
name: gates-fixed-assets
description: >-
  Fixed assets module (الأصول الثابتة) — asset register, categories, monthly
  depreciation runs, sale/disposal and the movement report, per EAS 10. Use when
  touching gates-backend/src/modules/fixed-assets, gates-web/app/fixed-assets, or
  when the user mentions أصول ثابتة، إهلاك، مجمع الإهلاك، صافي القيمة الدفترية،
  استبعاد أصل، بيع أصل، تشغيل الإهلاك.
---

# Gates fixed assets (الأصول الثابتة)

Built 2026-10-28 (phase 1). Plan and phases: `docs/architecture/FIXED_ASSETS_MODULE_PLAN.md`.
Files and endpoints: [reference.md](./reference.md).

## Owner decisions (do not change silently)
- **15th-of-month rule:** in service on/before the 15th → that month depreciates in full; after → starts next month. Same rule ends depreciation on disposal (`domain/depreciation.ts`).
- **Own top-level module** `/fixed-assets` (module key `fixedassets`).
- **Acquisition is its own document** (asset activation), not a purchase-invoice line. `EXISTING` assets (opening balance, or already charged to the asset account by an invoice) activate **without** a journal.
- **No reversal entries** (global rule): unpost is in place, delete cancels the journal.

## Invariants
- All fixed-asset journals use `sourceType: 'DEPRECIATION'` (existing `JournalSourceType`) with `sourceId` = asset slot `${assetId}:acquisition`, run id, or disposal id; distinguished by `entryType` `FA-ACQUISITION` / `FA-DEPRECIATION` / `FA-DISPOSAL`. They post through `autoGlPostingService.commitInTx`, so a repost after unpost reuses the **same journal and number**.
- `FixedAsset.accumulatedDepreciation` / `depreciatedThrough` are **caches**; truth = opening amount + lines of POSTED runs + catch-up on the POSTED disposal. Update them only in the same transaction, after `lockAssetsInTx` (sorted `FOR UPDATE`).
- Runs are **sequential per company**: a new run must be for a month after the last posted one; `activePeriodKey` (unique) blocks two posted runs for one month. Only the latest posted run can be unposted, and not if one of its assets was disposed since.
- One posted disposal per asset (`activeAssetKey` unique). Disposal books catch-up depreciation up to the disposal month, then closes cost and accumulated; gain/loss = proceeds − book value; sale VAT goes to the output-VAT account outside the gain/loss.
- Straight line spreads **remaining** depreciable amount over **remaining** months → opening balances and estimate revisions (life, salvage, method) apply prospectively (EAS 10). Cost, dates and accounts change only on DRAFT assets.
- Every foreign id (accounts, branch, cost center, employee, supplier, customer) is checked against `companyId` in `fixed-asset-refs.ts` — the tables hold them as plain ids. Run lines have no `companyId`: reach them through their run.
- The 4 company models are in `tenant-scoped-models.generated.ts` (added by hand — re-running the generator would also add 55 unrelated models; see CLAUDE.md §3).

## Do / don't
- Do reuse `depreciateMonths` / `projectSchedule` for any new calculation so preview, posting and reports agree.
- Don't write `accumulatedDepreciation` outside the run / disposal / activation services.
- Don't add a contra entry to "fix" a run — unpost the latest run, then repost.

## Tests
- Unit: `src/__tests__/unit/fixed-asset-depreciation.spec.ts` (math).
- Integration (MySQL): `src/__tests__/integration/fixed-assets.integration.spec.ts` — lifecycle, double-post races, in-place unpost/repost, sale, movement report, tenancy.
