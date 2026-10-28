import type { MigrationContext } from '../migration-context';
import { legacyTableExists } from '../accounting-source-profile';
import { countCashInvoiceAllocationRows } from './legacy-settlement-data.service';

/**
 * Records what operational modules exist in legacy without importing them.
 * Historical GL + inventory engine path already covers posted financial/stock truth;
 * full Invoice/Treasury document import would duplicate postings unless explicitly designed.
 */
export async function analyzeOperationalReadiness(ctx: MigrationContext) {
  const cc = ctx.legacyCompanyCode;
  const adapter = ctx.source;

  const tables = {
    InvoiceTrxHeader: await legacyTableExists(adapter, 'InvoiceTrxHeader'),
    InvoiceTrxDetail: await legacyTableExists(adapter, 'InvoiceTrxDetail'),
    CashTrxHeader: await legacyTableExists(adapter, 'CashTrxHeader'),
    CashTrxDetail: await legacyTableExists(adapter, 'CashTrxDetail'),
    CKTrxDetail: await legacyTableExists(adapter, 'CKTrxDetail'),
    CKTrxDetailSub: await legacyTableExists(adapter, 'CKTrxDetailSub'),
    SettlementTrxHeader: await legacyTableExists(adapter, 'SettlementTrxHeader'),
  };

  const counts: Record<string, number> = {};
  for (const [table, exists] of Object.entries(tables)) {
    if (!exists) {
      counts[table] = -1;
      continue;
    }
    try {
      counts[table] = await adapter.count(table, cc);
    } catch {
      counts[table] = -1;
    }
  }

  let cashInvoiceAllocationRows: number | null = null;
  if (tables.CashTrxDetail) {
    try {
      cashInvoiceAllocationRows = await countCashInvoiceAllocationRows(adapter, cc);
    } catch {
      cashInvoiceAllocationRows = null;
    }
  }

  const modules = [
    {
      id: 'SALES_PURCHASE_INVOICES',
      label: 'Sales / purchase invoices (operational shells)',
      supported: true,
      verified: false,
      reason:
        'COMMERCIAL stage imports posted InvoiceTrxHeader/Detail as read-only POSTED invoices linked to existing GLTrx journals (journalEntryId). No posting orchestrator. Requires GLNum link when MIGRATION_COMMERCIAL_REQUIRE_GL_LINK=true (default).',
      legacyRows: counts.InvoiceTrxHeader >= 0 ? counts.InvoiceTrxHeader : null,
    },
    {
      id: 'TREASURY_CASH_BANK',
      label: 'Treasury cash / bank vouchers (historical shells)',
      supported: true,
      verified: false,
      reason:
        'TREASURY_HISTORICAL imports posted CashTrxHeader linked to existing journals only. Does not create GL.',
      legacyRows: counts.CashTrxHeader >= 0 ? counts.CashTrxHeader : null,
    },
    {
      id: 'SETTLEMENTS',
      label: 'Customer / vendor settlements (cash ↔ invoice)',
      supported: true,
      verified: false,
      reason:
        'SETTLEMENT_HISTORICAL imports PaymentAllocation from CashTrxDetail.InvoiceType/InvoiceYearId/InvoiceNum joined to posted CashTrxHeader. SettlementTrxHeader is not in erp_schema.txt — blocked if that table has rows. Accepted=F lines skipped (reversed).',
      legacyRows: cashInvoiceAllocationRows,
    },
    {
      id: 'CHEQUES',
      label: 'Cheques (CK* inward / PK* module types)',
      supported: true,
      verified: false,
      reason:
        'CHEQUE_HISTORICAL: CKTrxDetail + PKTrxDetail (all CK*/PK* NewModule types) → Cheque; sub-lines link collection GL. Unknown types on wrong table → CHEQUE_UNKNOWN_TYPE issue. No posting service.',
      legacyRows:
        (counts.CKTrxDetail >= 0 ? counts.CKTrxDetail : 0) +
        (counts.CKTrxDetailSub >= 0 ? counts.CKTrxDetailSub : 0),
    },
    {
      id: 'INVENTORY_VALUATION_GL',
      label: 'Inventory valuation & inventory-to-GL',
      supported: false,
      verified: false,
      reason:
        'Periodic legacy accounting (301001/401001) — inventory GL control accounts empty in source. See FULL_CUTOVER_READINESS.md; valuation gaps block activation unless excepted.',
      legacyRows: null,
    },
  ];

  for (const mod of modules) {
    if (mod.supported) continue;
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: 'COMMERCIAL',
      severity: 'INFO',
      category: `MODULE_NOT_IMPORTED_${mod.id}`,
      description: `${mod.label}: ${mod.reason}`,
    });
  }

  return { tables, counts, cashInvoiceAllocationRows, modules };
}
