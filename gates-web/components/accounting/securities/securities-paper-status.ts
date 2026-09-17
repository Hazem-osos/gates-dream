import type { StatusTone } from '@/components/ui/StatusBadge';

export type SecuritiesPaperKind = 'payment' | 'receipt';

export const SECURITIES_PAPER_CASES = {
  ISSUED: 'ISSUED',
  COLLECTED: 'COLLECTED',
  MULTI_COLLECTED: 'MULTI_COLLECTED',
  ENDORSED: 'ENDORSED',
  BOUNCED: 'BOUNCED',
} as const;

export type SecuritiesPaperCase = (typeof SECURITIES_PAPER_CASES)[keyof typeof SECURITIES_PAPER_CASES];

export const SECURITIES_PAPER_CASE_LABEL: Record<SecuritiesPaperCase, string> = {
  ISSUED: 'محررة',
  COLLECTED: 'محصلة',
  MULTI_COLLECTED: 'تحصيل متعدد',
  ENDORSED: 'مظهرة',
  BOUNCED: 'مرتدة',
};

const CASE_TONE: Record<SecuritiesPaperCase, StatusTone> = {
  ISSUED: 'warning',
  COLLECTED: 'success',
  MULTI_COLLECTED: 'success',
  ENDORSED: 'info',
  BOUNCED: 'danger',
};

export type SecuritiesPaperRecord = {
  id: string;
  serial?: string | null;
  paymentNumber?: string | null;
  receiptNumber?: string | null;
  date?: string | Date | null;
  hijriDate?: string | null;
  description?: string | null;
  securityType?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  payeeName?: string | null;
  payeeBank?: string | null;
  issuerName?: string | null;
  issuerBank?: string | null;
  securityNumber?: string | null;
  dueDate?: string | Date | null;
  amount?: number | string | null;
  currencyCode?: string | null;
  paperCase?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  isPaid?: boolean;
  isReceived?: boolean;
  journalEntryId?: string | null;
  entityName?: string | null;
  destinationAccountId?: string | null;
  commissionAmount?: number | string | null;
  commissionAccountId?: string | null;
  multiCollectionLines?: unknown[] | null;
  journals?: Array<{ id: string; label: string; entryType?: string | null }> | null;
  customer?: { id?: string; code?: string | null; arabicName?: string | null; englishName?: string | null } | null;
  supplier?: { id?: string; code?: string | null; arabicName?: string | null; englishName?: string | null } | null;
};

export type SecuritiesPaperStatus = {
  tone: StatusTone;
  label: string;
  paperCase: SecuritiesPaperCase;
};

export function resolveSecuritiesPaperCase(
  record?: Partial<SecuritiesPaperRecord> | null
): SecuritiesPaperCase {
  const raw = record?.paperCase;
  if (
    raw === 'COLLECTED' ||
    raw === 'MULTI_COLLECTED' ||
    raw === 'ENDORSED' ||
    raw === 'BOUNCED' ||
    raw === 'ISSUED'
  ) {
    return raw;
  }
  if (record?.isCancelled) return 'BOUNCED';
  if (record?.isPosted && Array.isArray(record.multiCollectionLines) && record.multiCollectionLines.length > 0) {
    return 'MULTI_COLLECTED';
  }
  if (record?.isPosted) return 'COLLECTED';
  if (record?.description?.includes('تظهير')) return 'ENDORSED';
  return 'ISSUED';
}

/** Header / list status from persisted paper case — never a second footer badge. */
export function securitiesPaperStatus(record?: Partial<SecuritiesPaperRecord> | null): SecuritiesPaperStatus {
  if (!record?.id) return { tone: 'info', label: 'جديدة', paperCase: 'ISSUED' };
  const paperCase = resolveSecuritiesPaperCase(record);
  return { tone: CASE_TONE[paperCase], label: SECURITIES_PAPER_CASE_LABEL[paperCase], paperCase };
}

export function securitiesPaperTitle(kind: SecuritiesPaperKind): string {
  return kind === 'payment' ? 'ورقة مدفوعات' : 'ورقة مقبوضات';
}

export function isoDateOnly(value?: string | Date | null): string {
  if (!value) return '';
  const raw = typeof value === 'string' ? value : value.toISOString();
  return raw.slice(0, 10);
}
