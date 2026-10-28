import { legacyBool, legacyTrim } from '../transforms/legacy-values';
import type { LegacyCashInvoiceAllocationRow } from '../services/legacy-settlement-data.service';
import type { LegacyChequeLineRow } from '../services/legacy-cheque-data.service';
import type { ChequeDirection, ChequeStatus } from '@prisma/client';

export type TreasuryImportDecision =
  | { action: 'IMPORT' }
  | { action: 'SKIP_ALREADY_MAPPED'; reason: string }
  | { action: 'SKIP_INACTIVE'; reason: string }
  | { action: 'BLOCK'; reason: string; category: string };

/** Legacy Accepted on CashTrxDetail — explicit false means do not treat as active allocation. */
export function isActiveCashAllocationLine(row: LegacyCashInvoiceAllocationRow): boolean {
  const accepted = row.Accepted;
  if (accepted == null || legacyTrim(accepted) === '') return true;
  return legacyBool(accepted, true);
}

export function decideHistoricalSettlementImport(params: {
  row: LegacyCashInvoiceAllocationRow;
  cashTransactionId: string | null;
  invoiceId: string | null;
  alreadyMapped: boolean;
}): TreasuryImportDecision {
  if (params.alreadyMapped) {
    return { action: 'SKIP_ALREADY_MAPPED', reason: 'Allocation already mapped for this job' };
  }
  if (!isActiveCashAllocationLine(params.row)) {
    return {
      action: 'SKIP_INACTIVE',
      reason: 'CashTrxDetail Accepted flag marks line inactive (reversed/cancelled allocation)',
    };
  }
  const invNum = legacyTrim(params.row.InvoiceNum);
  const invType = legacyTrim(params.row.InvoiceType);
  if (!invNum || !invType) {
    return {
      action: 'BLOCK',
      reason: 'CashTrxDetail missing InvoiceType/InvoiceNum — cannot prove invoice link',
      category: 'SETTLEMENT_MISSING_INVOICE_KEY',
    };
  }
  if (!params.cashTransactionId) {
    return {
      action: 'BLOCK',
      reason: 'Parent CashTrxHeader not migrated — cannot link allocation without fabricated cash',
      category: 'SETTLEMENT_CASH_NOT_MAPPED',
    };
  }
  if (!params.invoiceId) {
    return {
      action: 'BLOCK',
      reason: `Invoice ${invType}/${invNum} not migrated for this job`,
      category: 'SETTLEMENT_INVOICE_NOT_MAPPED',
    };
  }
  const amt = Number(params.row.Amount ?? 0);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      action: 'BLOCK',
      reason: 'Allocation Amount must be positive',
      category: 'SETTLEMENT_INVALID_AMOUNT',
    };
  }
  return { action: 'IMPORT' };
}

/** CK* on CKTrxDetail = inward; PK* on PKTrxDetail = outward (legacy NewModule family). */
export function mapLegacyChequeDirection(
  type: string,
  sourceEntity: 'CKTrxDetail' | 'PKTrxDetail'
): ChequeDirection | null {
  const key = legacyTrim(type).toUpperCase();
  if (!key) return null;
  if (sourceEntity === 'CKTrxDetail') {
    if (key.startsWith('CK')) return 'INWARD';
    return null;
  }
  if (sourceEntity === 'PKTrxDetail') {
    if (key.startsWith('PK')) return 'OUTWARD';
    return null;
  }
  return null;
}

/** @deprecated use mapLegacyChequeDirection */
export const mapLegacyCkDirection = mapLegacyChequeDirection;

export function mapLegacyCkStatus(row: LegacyChequeLineRow): ChequeStatus {
  if (legacyBool(row.Deleted, false)) return 'CANCELLED';
  if (legacyBool(row.IsReturn, false)) return 'RETURNED_TO_DRAWER';
  if (legacyBool(row.IsTazher, false)) return 'ENDORSED';
  if (legacyBool(row.IsBank, false)) return 'SENT_TO_BANK';
  if (legacyBool(row.IsTake, false)) return 'COLLECTED';
  const st = legacyTrim(row.Status).toUpperCase();
  if (st === 'CANCEL' || st === 'CANCELLED') return 'CANCELLED';
  return 'UNDER_HAND';
}

export function decideHistoricalChequeImport(params: {
  row: LegacyChequeLineRow;
  sourceEntity: 'CKTrxDetail' | 'PKTrxDetail';
  alreadyMapped: boolean;
}): TreasuryImportDecision {
  if (params.alreadyMapped) {
    return { action: 'SKIP_ALREADY_MAPPED', reason: 'Cheque line already mapped' };
  }
  const direction = mapLegacyChequeDirection(String(params.row.Type ?? ''), params.sourceEntity);
  if (!direction) {
    return {
      action: 'BLOCK',
      reason: `Unknown cheque Type ${legacyTrim(params.row.Type)} for ${params.sourceEntity} — expected CK* (inward) or PK* (outward) module codes`,
      category: 'CHEQUE_UNKNOWN_TYPE',
    };
  }
  const amt = Number(params.row.Amount ?? 0);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      action: 'BLOCK',
      reason: 'Cheque Amount must be positive',
      category: 'CHEQUE_INVALID_AMOUNT',
    };
  }
  const idNum = legacyTrim(params.row.IdNum);
  const voucher = legacyTrim(params.row.CKNum) || legacyTrim(params.row.PKNum);
  if (!idNum && !voucher) {
    return {
      action: 'BLOCK',
      reason: 'Cheque line missing IdNum and voucher number (CKNum/PKNum)',
      category: 'CHEQUE_MISSING_IDENTIFIER',
    };
  }
  return { action: 'IMPORT' };
}

export function legacyChequeNumber(row: LegacyChequeLineRow): string {
  const idNum = legacyTrim(row.IdNum);
  if (idNum) return idNum;
  const voucher = legacyTrim(row.CKNum) || legacyTrim(row.PKNum);
  const id = legacyTrim(row.Id);
  return id ? `LEGACY-${voucher}-${id}` : `LEGACY-${voucher}-${legacyTrim(row.Type)}`;
}
