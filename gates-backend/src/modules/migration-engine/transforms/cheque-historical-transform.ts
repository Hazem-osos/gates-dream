import { money } from '../accounting/journal-money';
import { legacyDate, legacyTrim } from './legacy-values';
import type { LegacyChequeLineRow } from '../services/legacy-cheque-data.service';
import type { LegacyCashInvoiceAllocationRow } from '../services/legacy-settlement-data.service';
import {
  legacyChequeNumber,
  mapLegacyChequeDirection,
  mapLegacyCkStatus,
} from '../treasury/settlement-cheque-decision';

export function transformHistoricalCheque(
  row: LegacyChequeLineRow,
  sourceEntity: 'CKTrxDetail' | 'PKTrxDetail',
  ids: {
    companyId: string;
    branchId?: string | null;
    fiscalYearId?: string | null;
    customerId?: string | null;
    supplierId?: string | null;
    portfolioJournalEntryId?: string | null;
    depositJournalEntryId?: string | null;
    clearJournalEntryId?: string | null;
    endorseJournalEntryId?: string | null;
    cancelJournalEntryId?: string | null;
  }
) {
  const direction = mapLegacyChequeDirection(String(row.Type ?? ''), sourceEntity);
  if (!direction) throw new Error(`Unmapped cheque direction for Type ${legacyTrim(row.Type)}`);

  return {
    companyId: ids.companyId,
    branchId: ids.branchId ?? null,
    fiscalYearId: ids.fiscalYearId ?? null,
    direction,
    status: mapLegacyCkStatus(row),
    chequeNumber: legacyChequeNumber(row),
    bankName: legacyTrim(row.Name) || legacyTrim(row.BankAccountNo) || null,
    dueDate: legacyDate(row.TakeDate) ?? legacyDate(row.BankDate) ?? legacyDate(row.EditDate),
    amount: money(row.Amount),
    currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
    sourceYearId: legacyTrim(row.YearID) || null,
    customerId: ids.customerId ?? null,
    supplierId: ids.supplierId ?? null,
    description: legacyTrim(row.DetailDescA) || legacyTrim(row.DetailDescE) || null,
    invoiceId: null,
    portfolioJournalEntryId: ids.portfolioJournalEntryId ?? null,
    depositJournalEntryId: ids.depositJournalEntryId ?? null,
    clearJournalEntryId: ids.clearJournalEntryId ?? null,
    issueJournalEntryId: ids.portfolioJournalEntryId ?? null,
    cancelJournalEntryId: ids.cancelJournalEntryId ?? null,
    endorseJournalEntryId: ids.endorseJournalEntryId ?? null,
  };
}

export function ckTrxSourceKeyParts(row: LegacyChequeLineRow, companyCode: string) {
  return {
    companyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    ckNum: legacyTrim(row.CKNum),
    lineId: legacyTrim(row.Id),
    idNum: legacyTrim(row.IdNum),
  };
}

export function pkTrxSourceKeyParts(row: LegacyChequeLineRow, companyCode: string) {
  return {
    companyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    pkNum: legacyTrim(row.PKNum),
    idNum: legacyTrim(row.IdNum),
  };
}

export function cashAllocationSourceKeyParts(row: LegacyCashInvoiceAllocationRow, companyCode: string) {
  return {
    companyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    cashType: legacyTrim(row.Type),
    cashNum: legacyTrim(row.CashNum),
    detailNum: legacyTrim(row.DetailNum),
  };
}
