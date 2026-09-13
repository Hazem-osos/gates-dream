import type { StatusTone } from '@/components/ui/StatusBadge';

export type SecuritiesPaperKind = 'payment' | 'receipt';

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
  isPosted?: boolean;
  isCancelled?: boolean;
  isPaid?: boolean;
  isReceived?: boolean;
  journalEntryId?: string | null;
  entityName?: string | null;
  destinationAccountId?: string | null;
  commissionAmount?: number | string | null;
  commissionAccountId?: string | null;
  customer?: { id?: string; code?: string | null; arabicName?: string | null; englishName?: string | null } | null;
  supplier?: { id?: string; code?: string | null; arabicName?: string | null; englishName?: string | null } | null;
};

export type SecuritiesPaperStatus = {
  tone: StatusTone;
  label: string;
};

/** Header / list status from persisted flags — never a second footer badge. */
export function securitiesPaperStatus(record?: Partial<SecuritiesPaperRecord> | null): SecuritiesPaperStatus {
  if (!record?.id) return { tone: 'info', label: 'جديدة' };
  if (record.isCancelled) return { tone: 'danger', label: 'مرتدة' };
  if (record.isPosted && (record.isPaid === false || record.isReceived === false)) {
    return { tone: 'warning', label: 'تحت التحصيل' };
  }
  if (record.isPosted) return { tone: 'success', label: 'محصلة' };
  return { tone: 'warning', label: 'جديدة' };
}

export function securitiesPaperTitle(kind: SecuritiesPaperKind): string {
  return kind === 'payment' ? 'ورقة مدفوعات' : 'ورقة مقبوضات';
}

export function isoDateOnly(value?: string | Date | null): string {
  if (!value) return '';
  const raw = typeof value === 'string' ? value : value.toISOString();
  return raw.slice(0, 10);
}
