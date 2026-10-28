# Fixed assets — reference

## Backend (`gates-backend/src/modules/fixed-assets/`)
| File | Role |
|---|---|
| `domain/depreciation.ts` | Pure math: month keys, 15th rule, straight line, declining balance, schedule, gain/loss |
| `schemas/fixed-asset.schemas.ts` | zod bodies/queries |
| `services/fixed-asset-refs.ts` | tenant checks for foreign ids, `lockAssetsInTx`, year-start accumulated, preview account names |
| `services/fixed-asset-category.service.ts` | categories (tree, default accounts/estimates) |
| `services/fixed-asset.service.ts` | assets: create/update/delete, activate (purchase journal), deactivate |
| `services/fixed-asset-depreciation.service.ts` | runs: preview, post, unpost, repost, delete |
| `services/fixed-asset-disposal.service.ts` | sale / scrap: preview, post, unpost, delete |
| `services/fixed-asset-report.service.ts` | summary, per-asset schedule, movement (roll-forward) report |
| `routes/fixed-assets.routes.ts` | mounted at `/api/v1/fixed-assets` in `src/app.ts` |

Permission resource `fixed-asset` — actions `view / edit / delete / post / unpost`
(catalog: `modules/users/services/permission-definitions.service.ts`; accountant fallback in `authorize.middleware.ts`).

Numbering families (`documentSequenceService.nextNumberInTx`, scope `C`): `FA` asset code, `FADEP` run, `FADSP` disposal.

## Endpoints
`GET|POST /categories`, `PUT|DELETE /categories/:id` ·
`GET /assets` (page, limit, search, status, categoryId, branchId), `GET /assets/summary`, `GET /assets/:id`, `GET /assets/:id/schedule`, `POST /assets`, `PUT|DELETE /assets/:id` (PUT needs `version`), `POST /assets/:id/activate`, `POST /assets/:id/deactivate` ·
`GET /depreciation-runs`, `POST /depreciation-runs/preview`, `POST /depreciation-runs`, `GET /depreciation-runs/:id`, `POST /depreciation-runs/:id/unpost|repost`, `DELETE /depreciation-runs/:id` ·
`GET /disposals`, `POST /disposals/preview`, `POST /disposals`, `POST /disposals/:id/unpost`, `DELETE /disposals/:id` ·
`GET /reports/movement?from&to&categoryId`

## Prisma
`FixedAssetCategory`, `FixedAsset`, `FixedAssetDepreciationRun`, `FixedAssetDepreciationLine` (child, no companyId), `FixedAssetDisposal`; enums `FixedAssetDepreciationMethod`, `FixedAssetStatus`, `FixedAssetAcquisitionType`, `FixedAssetDocumentStatus`, `FixedAssetDisposalType`.
Migration `prisma/migrations/20261028170000_fixed_assets_module` — CREATE TABLE only.

## Frontend
Pages `gates-web/app/fixed-assets/` (home, `categories`, `assets`, `assets/new`, `assets/[id]`, `depreciation`, `disposals`, `reports/movement`); components `gates-web/components/fixed-assets/`; types `gates-web/lib/fixed-assets/types.ts`; sidebar `app/components/FixedAssetsSidebar.tsx`; query keys `queryKeys.fixedAssets.*`.

## Running the integration test
Local MySQL (3307) + a scratch DB built from the schema (the dev DB carries an old failed migration):
`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → load into a new database with `mysql --force`, then
`DATABASE_URL=mysql://root:…@127.0.0.1:3307/<scratch> npx jest src/__tests__/integration/fixed-assets.integration.spec.ts --runInBand --forceExit`.

## Phase 2/3 backlog
Transfers/custody history, capital additions, units-of-production, Excel import, barcode labels, tax-depreciation book (Law 91/2005 — verify rates on the official text), purchase-invoice → asset, GL tie-out check, revaluation, impairment (EAS 31), maintenance, insurance. BullMQ for very large runs.
