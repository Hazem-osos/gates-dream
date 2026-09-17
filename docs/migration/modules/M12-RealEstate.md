# M12 — Real Estate & Unit Management (Wave 3)

## Scope

- **Master data:** `RealEstateProject` → `RealEstateBuilding` → `RealEstateUnit` (status lifecycle).
- **Sales:** `UnitContract` with automated installment schedule (monthly / quarterly / semi-annual / annual + optional balloon).
- **GL:** Contract execution (AR + unearned revenue + maintenance deposit), installment collection via M2 treasury, revenue recognition on handover with project cost center.

## Prisma models

| Model | Purpose |
|-------|---------|
| `RealEstateSettings` | GL account codes (AR, unearned, revenue, maintenance, penalties) |
| `RealEstateProject` | Development project + optional `costCenterId` |
| `RealEstateBuilding` | Tower / block under project |
| `RealEstateUnit` | Sellable unit specs and status |
| `UnitContract` | Buyer contract, balances, journal links |
| `UnitInstallment` | Schedule lines; links to `CashTransaction` / `Cheque` |

Migration: `20250816250000_wave3_m12_real_estate`.

## API (Wave 3)

| Method | Path | Action |
|--------|------|--------|
| POST | `/api/v1/real-estate/units/projects` | Create RE project |
| POST | `/api/v1/real-estate/buildings` | Create building |
| POST | `/api/v1/real-estate/units` | Create unit |
| POST | `/api/v1/real-estate/contracts` | Book contract + generate schedule |
| POST | `/api/v1/real-estate/contracts/:id/post-contract` | Post contract execution JE |
| POST | `/api/v1/real-estate/contracts/:id/handover` | Delivery + revenue recognition |
| POST | `/api/v1/real-estate/installments/:id/collect` | Collect installment (treasury receipt) |

Legacy UI routes under `/api/v1/real-estate/properties`, reservations, etc. remain unchanged.

## Services

- `real-estate-unit.service.ts` — projects, buildings, units
- `installment-schedule.service.ts` — schedule generator
- `unit-contract.service.ts` — contract, GL posting, M2 collection, handover
- `real-estate-account-resolver.service.ts` — settings + account IDs

## Integration test

```bash
npm run test:wave1-invoices   # fixtures
npm run test:wave1-treasury   # safe + GL (recommended)
npm run test:wave3-real-estate
```

Covers: building + unit → 20% down + 4 quarterly installments → contract JE → one treasury collection → handover revenue transfer.

## Posting rules (summary)

1. **Contract:** Dr RE AR (contract total); Cr unearned revenue; Dr RE AR (maintenance); Cr maintenance deposits liability.
2. **Collection:** Dr safe/bank (M2); Cr RE AR; updates `outstandingArBalance`.
3. **Handover:** Dr unearned revenue; Cr RE revenue (with project cost center).
