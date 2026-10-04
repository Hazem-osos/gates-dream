import { JournalSourceType } from '@prisma/client';
import { AUTO_GL_SOURCE } from '../types/auto-gl-posting.types';

const AUTO_GL_TO_KIND: Record<string, JournalSourceType> = {
  [AUTO_GL_SOURCE.SALES_INVOICE]: JournalSourceType.SALES_INVOICE,
  [AUTO_GL_SOURCE.PURCHASE_INVOICE]: JournalSourceType.PURCHASE_INVOICE,
  [AUTO_GL_SOURCE.SALE_RETURN]: JournalSourceType.SALES_RETURN,
  [AUTO_GL_SOURCE.PURCHASE_RETURN]: JournalSourceType.PURCHASE_RETURN,
  [AUTO_GL_SOURCE.TREASURY_RECEIPT]: JournalSourceType.RECEIPT_VOUCHER,
  [AUTO_GL_SOURCE.TREASURY_PAYMENT]: JournalSourceType.PAYMENT_VOUCHER,
  [AUTO_GL_SOURCE.CONTRACTOR_EXTRACT_PAYMENT]: JournalSourceType.PAYMENT_VOUCHER,
  [AUTO_GL_SOURCE.CHECK_COLLECT]: JournalSourceType.CHEQUE_ENDORSEMENT,
  [AUTO_GL_SOURCE.CHECK_BOUNCE]: JournalSourceType.CHEQUE_ENDORSEMENT,
  [AUTO_GL_SOURCE.CHECK_ENDORSE]: JournalSourceType.CHEQUE_ENDORSEMENT,
  [AUTO_GL_SOURCE.SECURITIES_RECEIPT]: JournalSourceType.SECURITIES_RECEIPT,
  [AUTO_GL_SOURCE.SECURITIES_PAYMENT]: JournalSourceType.SECURITIES_PAYMENT,
  [AUTO_GL_SOURCE.SECURITIES_RENEWAL]: JournalSourceType.SECURITIES_RECEIPT,
};

const KIND_VALUES = new Set<string>(Object.values(JournalSourceType));

export function isJournalSourceKind(value: string | null | undefined): value is JournalSourceType {
  return !!value && KIND_VALUES.has(value);
}

/**
 * Resolve the display/API origin. Accepts the long `JournalSourceType` name,
 * an Auto-GL short code (`SI`, `PI`, …), or an already-set `sourceKind`.
 */
export function resolveJournalSourceKind(
  sourceType?: string | null,
  sourceKind?: string | null
): JournalSourceType {
  if (sourceType && AUTO_GL_TO_KIND[sourceType]) return AUTO_GL_TO_KIND[sourceType];
  const sourcePrefix = String(sourceType ?? '').split('-')[0];
  if (sourcePrefix && AUTO_GL_TO_KIND[sourcePrefix]) return AUTO_GL_TO_KIND[sourcePrefix];
  if (isJournalSourceKind(sourceKind) && sourceKind !== JournalSourceType.MANUAL) return sourceKind;
  if (isJournalSourceKind(sourceType)) return sourceType;
  return JournalSourceType.MANUAL;
}

export const SOURCED_JOURNAL_MUTATION_MESSAGE =
  'هذا القيد مربوط بمستند مصدر. أي تعديل أو فك ترحيل يتم من المستند الأصلي فقط، وليس من قيد اليومية.';

const JOURNAL_OWNED_KINDS = new Set<JournalSourceType>([
  JournalSourceType.MANUAL,
  JournalSourceType.RECURRING_TEMPLATE,
]);

export function isSourcedJournalEntry(row: {
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  entryType?: string | null;
  isCyclic?: boolean | null;
  isRecurring?: boolean | null;
}): boolean {
  const kind = resolveJournalSourceKind(row.sourceType, row.sourceKind);
  if (kind === JournalSourceType.RECURRING_TEMPLATE) return false;
  // «سند دوري» stores the template id on sourceId. That link is not a source document.
  if ((row.isCyclic || row.isRecurring) && JOURNAL_OWNED_KINDS.has(kind)) return false;
  if (!JOURNAL_OWNED_KINDS.has(kind)) return true;
  if (String(row.sourceId ?? '').trim()) return true;
  const sourceType = String(row.sourceType ?? '').trim();
  if (sourceType && sourceType !== 'MANUAL' && !JOURNAL_OWNED_KINDS.has(sourceType as JournalSourceType)) {
    return true;
  }
  const entryType = String(row.entryType ?? '').trim().toUpperCase();
  if (!entryType || entryType === 'MANUAL' || entryType === 'OPENING_BALANCE') return false;
  if (entryType === 'REVERSAL' || entryType === 'YEARCLOSE') return true;
  if (entryType.includes('COGS') || entryType.includes('RETURN')) return true;
  return entryType === 'SALE' || entryType === 'PURCHASE';
}

/**
 * Persist Auto-GL short codes unchanged. Long enum names (except MANUAL)
 * are stored so listings can still map legacy rows without `sourceKind`.
 */
const STOCK_GL_SOURCE = new Set(['GI', 'GR', 'STK', 'ADJ', 'OADJ', 'TRF', 'OB']);
const POS_GL_SOURCE = new Set(['POS', 'POS-SALE', 'POS-RETURN', 'POS-VOID', 'POS-CASH', 'POS-VARIANCE', 'POS-COLLECTION', 'POS-DEPOSIT', 'POS-GIFT', 'POS-POINTS']);

export function persistJournalSourceType(
  sourceType?: string | null,
  sourceKind?: JournalSourceType
): string | undefined {
  if (sourceType && AUTO_GL_TO_KIND[sourceType]) return sourceType;
  if (sourceType && STOCK_GL_SOURCE.has(sourceType)) return sourceType;
  if (sourceType && POS_GL_SOURCE.has(sourceType)) return sourceType;
  if (isJournalSourceKind(sourceType) && sourceType !== JournalSourceType.MANUAL) {
    return sourceType;
  }
  if (sourceKind && sourceKind !== JournalSourceType.MANUAL) return sourceKind;
  return undefined;
}
