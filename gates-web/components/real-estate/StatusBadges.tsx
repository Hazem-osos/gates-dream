'use client';

import { Lock } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { InstallmentStatus, InstallmentType, PdcStatus, UnitContractStatus } from '@/lib/real-estate/types';

const CONTRACT_LABEL: Record<UnitContractStatus, string> = {
  ACTIVE: 'ساري',
  RESALE_IN_PROGRESS: 'إعادة بيع قيد التنفيذ',
  TRANSFERRED: 'محوّل',
  TERMINATED: 'ملغى',
  TERMINATED_FORFEITED: 'فسخ ومصادرة',
  COMPLETED: 'مكتمل',
};

const CONTRACT_TONE: Record<UnitContractStatus, StatusTone> = {
  ACTIVE: 'success',
  RESALE_IN_PROGRESS: 'warning',
  TRANSFERRED: 'info',
  TERMINATED: 'neutral',
  TERMINATED_FORFEITED: 'danger',
  COMPLETED: 'info',
};

export const INSTALLMENT_TYPE_LABEL: Record<InstallmentType, string> = {
  RESERVATION_DEPOSIT: 'عربون حجز',
  CONTRACTING_DOWNPAYMENT: 'دفعة تعاقد',
  REGULAR_INSTALLMENT: 'قسط دوري',
  DELIVERY_PAYMENT: 'دفعة تسليم',
  MAINTENANCE_DEPOSIT: 'وديعة صيانة',
  ANNUAL_BALLOON: 'قسط سنوي / بالون',
};

const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  PENDING: 'غير مدفوع',
  UNPAID: 'غير مدفوع',
  PARTIALLY_PAID: 'مدفوع جزئيًا',
  PAID: 'مدفوع',
  OVERDUE: 'متأخر',
  RESCHEDULED: 'معاد جدولته',
  CANCELLED: 'ملغى',
};

const INSTALLMENT_STATUS_TONE: Record<InstallmentStatus, StatusTone> = {
  PENDING: 'warning',
  UNPAID: 'warning',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  RESCHEDULED: 'neutral',
  CANCELLED: 'neutral',
};

export const PDC_LABEL: Record<PdcStatus, string> = {
  UNDER_SAFE_CUSTODY: 'تحت الحفظ بالخزينة',
  DEPOSITED_UNDER_COLLECTION: 'برسم التحصيل',
  CLEARED_COLLECTED: 'محصّل',
  BOUNCED_RETURNED: 'مرتد',
  REPLACED_CANCELLED: 'مستبدل / ملغى',
};

const PDC_TONE: Record<PdcStatus, StatusTone> = {
  UNDER_SAFE_CUSTODY: 'info',
  DEPOSITED_UNDER_COLLECTION: 'warning',
  CLEARED_COLLECTED: 'success',
  BOUNCED_RETURNED: 'danger',
  REPLACED_CANCELLED: 'neutral',
};

export function ContractStatusBadge({ status }: { status: UnitContractStatus }) {
  return <StatusBadge label={CONTRACT_LABEL[status] ?? status} tone={CONTRACT_TONE[status] ?? 'neutral'} compact />;
}

export function ResaleLockBadge({ locked }: { locked: boolean }) {
  if (!locked) {
    return <StatusBadge label="الوحدة قابلة للتحويل" tone="success" compact />;
  }
  return <StatusBadge label="مقفولة ضد التحويل" tone="danger" icon={Lock} compact />;
}

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  return (
    <StatusBadge
      label={INSTALLMENT_STATUS_LABEL[status] ?? status}
      tone={INSTALLMENT_STATUS_TONE[status] ?? 'neutral'}
      compact
    />
  );
}

export function PdcStatusBadge({ status }: { status: PdcStatus }) {
  return <StatusBadge label={PDC_LABEL[status] ?? status} tone={PDC_TONE[status] ?? 'neutral'} compact />;
}
