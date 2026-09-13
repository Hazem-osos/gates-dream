'use client';

import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { SubcontractInvoiceStatus, SubcontractStatus } from '@/lib/subcontracts/types';

const CONTRACT_LABEL: Record<SubcontractStatus, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'ساري',
  SUSPENDED: 'موقوف',
  COMPLETED: 'منتهٍ',
  TERMINATED: 'ملغى',
};

const CONTRACT_TONE: Record<SubcontractStatus, StatusTone> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  COMPLETED: 'info',
  TERMINATED: 'neutral',
};

const INVOICE_LABEL: Record<SubcontractInvoiceStatus, string> = {
  DRAFT: 'مسودة',
  SITE_SUBMITTED: 'مقدم لمهندس الموقع',
  CONSULTANT_APPROVED: 'معتمد استشاري',
  TECH_OFFICE_APPROVED: 'معتمد مكتب فني',
  FINANCE_POSTED: 'مرحل حسابات',
  REJECTED: 'مرفوض',
  PAID: 'مدفوع',
};

const INVOICE_TONE: Record<SubcontractInvoiceStatus, StatusTone> = {
  DRAFT: 'warning',
  SITE_SUBMITTED: 'info',
  CONSULTANT_APPROVED: 'info',
  TECH_OFFICE_APPROVED: 'info',
  FINANCE_POSTED: 'success',
  REJECTED: 'danger',
  PAID: 'success',
};

export function SubcontractStatusBadge({ status }: { status: SubcontractStatus }) {
  return <StatusBadge label={CONTRACT_LABEL[status] ?? status} tone={CONTRACT_TONE[status] ?? 'neutral'} compact />;
}

export function InvoiceStatusBadge({ status }: { status: SubcontractInvoiceStatus }) {
  return <StatusBadge label={INVOICE_LABEL[status] ?? status} tone={INVOICE_TONE[status] ?? 'neutral'} compact />;
}

export { CONTRACT_LABEL, INVOICE_LABEL };
