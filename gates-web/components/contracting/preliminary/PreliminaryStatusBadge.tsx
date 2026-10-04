'use client';

import {
  PRELIMINARY_STATUS_LABEL,
  type PreliminaryCertificateStatus,
} from '@/lib/contracting/preliminary-types';

const TONE: Record<PreliminaryCertificateStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-800',
  SUBMITTED: 'bg-blue-50 text-blue-900',
  UNDER_REVIEW: 'bg-indigo-50 text-indigo-900',
  APPROVED: 'bg-emerald-50 text-emerald-900',
  CONVERTED: 'bg-teal-50 text-teal-900',
  REJECTED: 'bg-red-50 text-red-900',
  CANCELLED: 'bg-slate-200 text-slate-700',
};

export function PreliminaryStatusBadge({ status }: { status: PreliminaryCertificateStatus }) {
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}>
      {PRELIMINARY_STATUS_LABEL[status]}
    </span>
  );
}
