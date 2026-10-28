import { legacyTrim } from '../transforms/legacy-values';
import { mapLegacyInvoiceKind } from '../transforms/commercial-document-transform';

export type CommercialImportDecision =
  | { action: 'IMPORT' }
  | { action: 'SKIP_ALREADY_MAPPED'; reason: string }
  | { action: 'BLOCK'; reason: string; category: string };

export function decideHistoricalInvoiceShellImport(params: {
  type: string;
  mode: 'DRAFT' | 'CANCELLED';
  alreadyMapped: boolean;
}): CommercialImportDecision {
  if (params.alreadyMapped) {
    return { action: 'SKIP_ALREADY_MAPPED', reason: 'Invoice shell already mapped for this job' };
  }
  if (!mapLegacyInvoiceKind(params.type)) {
    return { action: 'BLOCK', reason: `Unknown invoice Type ${legacyTrim(params.type)}`, category: 'UNKNOWN_INVOICE_TYPE' };
  }
  return { action: 'IMPORT' };
}

export function decideHistoricalInvoiceImport(params: {
  type: string;
  glNum: string;
  journalEntryId: string | null;
  alreadyMapped: boolean;
  requireJournalLink: boolean;
}): CommercialImportDecision {
  if (params.alreadyMapped) {
    return { action: 'SKIP_ALREADY_MAPPED', reason: 'Invoice already mapped for this job' };
  }
  if (!mapLegacyInvoiceKind(params.type)) {
    return { action: 'BLOCK', reason: `Unknown invoice Type ${legacyTrim(params.type)}`, category: 'UNKNOWN_INVOICE_TYPE' };
  }
  const gl = legacyTrim(params.glNum);
  if (params.requireJournalLink && !gl) {
    return {
      action: 'BLOCK',
      reason: 'Posted invoice has no GLNum — cannot link historical journal without inventing GL',
      category: 'MISSING_GLNUM',
    };
  }
  if (params.requireJournalLink && gl && !params.journalEntryId) {
    return {
      action: 'BLOCK',
      reason: `GLNum ${gl} not found in migrated journals for this job`,
      category: 'JOURNAL_LINK_MISSING',
    };
  }
  return { action: 'IMPORT' };
}

export function decideHistoricalCashImport(params: {
  glNum: string;
  journalEntryId: string | null;
  alreadyMapped: boolean;
}): CommercialImportDecision {
  if (params.alreadyMapped) {
    return { action: 'SKIP_ALREADY_MAPPED', reason: 'Cash voucher already mapped' };
  }
  const gl = legacyTrim(params.glNum);
  if (!gl) {
    return {
      action: 'BLOCK',
      reason: 'CashTrxHeader has no GLNum — treasury import requires proven journal link (no new GL)',
      category: 'CASH_MISSING_GLNUM',
    };
  }
  if (!params.journalEntryId) {
    return {
      action: 'BLOCK',
      reason: `Cash GLNum ${gl} not found in migrated journals`,
      category: 'CASH_JOURNAL_LINK_MISSING',
    };
  }
  return { action: 'IMPORT' };
}
