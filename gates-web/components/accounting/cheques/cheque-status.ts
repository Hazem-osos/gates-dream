import type { StatusTone } from '@/components/ui/StatusBadge';

export type ChequeDirection = 'INWARD' | 'OUTWARD';

export type ChequeStatus =
  | 'UNDER_HAND'
  | 'SENT_TO_BANK'
  | 'COLLECTED'
  | 'ENDORSED'
  | 'BOUNCED'
  | 'RETURNED_TO_DRAWER'
  | 'CANCELLED';

export type ChequeParty = { id: string; code?: string | null; arabicName: string };

export type ChequeRecord = {
  id: string;
  direction: ChequeDirection;
  status: ChequeStatus;
  chequeNumber: string;
  bankName: string | null;
  dueDate: string | Date | null;
  amount: number;
  currencyCode: string;
  description?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  bankAccountId?: string | null;
  customer?: ChequeParty | null;
  supplier?: ChequeParty | null;
  endorsedSupplier?: ChequeParty | null;
  bankAccount?: { id: string; accountNumber?: string | null; arabicName?: string | null } | null;
};

export const CHEQUE_STATUS_LABEL: Record<ChequeStatus, string> = {
  UNDER_HAND: 'في الخزينة',
  SENT_TO_BANK: 'برسم التحصيل',
  COLLECTED: 'تم التحصيل',
  ENDORSED: 'مظهر لمورد',
  BOUNCED: 'مرفوض / مرتد',
  RETURNED_TO_DRAWER: 'رد للساحب',
  CANCELLED: 'ملغي',
};

export const CHEQUE_STATUS_TONE: Record<ChequeStatus, StatusTone> = {
  UNDER_HAND: 'info',
  SENT_TO_BANK: 'warning',
  COLLECTED: 'success',
  ENDORSED: 'purple',
  BOUNCED: 'danger',
  RETURNED_TO_DRAWER: 'warning',
  CANCELLED: 'neutral',
};

export function isChequeStatus(value: unknown): value is ChequeStatus {
  return typeof value === 'string' && value in CHEQUE_STATUS_LABEL;
}

export function chequePartyName(row: ChequeRecord): string {
  const party = row.direction === 'OUTWARD' ? row.supplier : row.customer;
  if (!party) return '—';
  return party.code ? `[${party.code}] ${party.arabicName}` : party.arabicName;
}

export function formatChequeAmount(amount: number, currency = 'EGP'): string {
  const formatted = Number(amount || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

export function isoDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
}
