# Tenant / companyId Scoping Rules (New ERP)

**Purpose:** Every migrated row must land in exactly one target company. No fallback tenant.

---

## 1. How production enforces tenancy

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| Request context | `setTenantContext` middleware | Binds `companyId` per HTTP request |
| Prisma extension | `tenant-scoping.extension.ts` | AND-filters reads; **overwrites** `companyId` on create with context company |
| Bypass | `runWithoutTenantScoping` | Scripts, migration CLI, admin jobs |
| Generated set | `tenant-scoped-models.generated.ts` | ~135 models with direct `companyId` field |

**Constitution:** MySQL has no RLS; services must still pass `companyId` — extension is a safety net, not the only layer.

---

## 2. MigrationContext (required design)

```ts
interface MigrationContext {
  migrationJobId: string;      // UUID — provenance for all writes in this run
  sourceDatabase: string;        // e.g. GatesImprove, dump path — audit only
  targetCompanyId: string;       // MUST be resolved before any tenant write
  legacyCompanyCode: string;     // Filter in extractor — maps to target via Company.legacyCompanyCode
  options: MigrationOptions;     // dryRun, phases, limits, feature flags
  bypassTenantExtension: true;   // CLI uses raw prisma + explicit companyId on every row
}
```

**Rules:**

1. **NO** “first company in DB”.
2. **NO** default `companyId` if `legacyCompanyCode` missing or ambiguous.
3. Resolve `targetCompanyId` by: operator selects company in admin UI **or** CLI `--company=<legacy code>` → lookup `Company.legacyCompanyCode`.
4. If lookup fails → **BLOCK** job (do not create a new `Company` unless phase explicitly allows and operator confirms).

Existing CLI pattern (`migrate-legacy-data.ts`): `--company=<CompanyCode>` filters source rows; company row upserted in phase A with `legacyCompanyCode`.

---

## 3. Tables requiring direct `companyId`

All models in `TENANT_SCOPED_MODELS` — regenerate via:

`node gates-backend/scripts/generate-tenant-scoped-models.mjs`

Examples migration-critical: `account`, `branch`, `customer`, `supplier`, `item`, `warehouse`, `journalEntry`, `journalEntryLine`, `invoice`, `inventoryMovement`, `openingStock`, …

---

## 4. Indirect scoping (child rows)

| Child | Scoped via |
|-------|------------|
| `JournalEntryLine` | `journalEntryId` → `JournalEntry.companyId` |
| `InvoiceLine` | `invoiceId` → `Invoice.companyId` |
| `OpeningStockLine` | `openingStockId` |

**Migration rule:** Still set `companyId` on parent at insert; children inherit FK integrity. Extension may not stamp children without `companyId` field — verify per model in schema.

---

## 5. Global / reference tables

Models **without** `companyId` (not in TENANT_SCOPED set): system-wide reference data, join tables scoped by parent, etc.

**Do not** put tenant business data in global tables.

---

## 6. Unique constraints involving company

Examples (see schema):

- `Company.legacyCompanyCode` — unique globally
- `JournalEntry`: `@@unique([companyId, branchId, fiscalYearId, legacyGlNum])`
- Account: `@@unique([companyId, code])` (pattern)

Idempotency keys in `03-etl-pipeline.md` align with these uniques.

---

## 7. Branch scoping

`Branch` requires `companyId`. Many documents also store `branchId`. Legacy `BranchCode` maps through `legacyBranchCode`.

**Risk:** Partial migration with unresolved `branchId` caused duplicate GL (documented in `phase-c-transactions.ts`). Engine must **adopt** orphan rows or fail closed.

---

## 8. Multi-company legacy DB → single new company

One legacy `CompanyCode` → one `targetCompanyId` per job.

Migrating **multiple** legacy companies into one new tenant (consolidation) is **BLOCKED_NEEDS_BUSINESS_DECISION** — chart codes, doc numbers, and uniques collide.

---

## 9. Security

- Legacy credentials: read-only SQL login; never in logs or frontend.
- Target writes: only `targetCompanyId` + `migrationJobId` provenance.
- Rollback: delete by `migrationJobId` once column exists; until then, company-scoped delete is destructive (see `05-production-runbook.md`).
