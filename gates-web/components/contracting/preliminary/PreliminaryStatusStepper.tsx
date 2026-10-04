'use client';

import { Check } from 'lucide-react';
import {
  PRELIMINARY_STATUS_LABEL,
  type PreliminaryCertificateStatus,
} from '@/lib/contracting/preliminary-types';

const FLOW = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'CONVERTED',
] as const satisfies readonly PreliminaryCertificateStatus[];

const FLOW_LABEL: Record<(typeof FLOW)[number], string> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'مرسل للمراجعة',
  UNDER_REVIEW: 'تحت المراجعة',
  APPROVED: 'معتمد',
  CONVERTED: 'تم التحويل',
};

function stepIndex(status: PreliminaryCertificateStatus): number {
  if (status === 'REJECTED' || status === 'CANCELLED') return -1;
  const idx = (FLOW as readonly PreliminaryCertificateStatus[]).indexOf(status);
  return idx >= 0 ? idx : 0;
}

export function PreliminaryStatusStepper({ status }: { status: PreliminaryCertificateStatus }) {
  const current = stepIndex(status);
  const terminal = status === 'REJECTED' || status === 'CANCELLED';

  if (terminal) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        الحالة: <strong>{PRELIMINARY_STATUS_LABEL[status]}</strong>
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {FLOW.map((step, index) => {
        const done = index < current || status === 'CONVERTED';
        const active = index === current;
        return (
          <li
            key={step}
            className={`rounded-xl border px-2 py-2 text-center text-xs sm:text-sm ${
              done || active ? 'border-[#0E78AA] bg-[#F0F7FB]' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="mb-1 flex justify-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  done ? 'bg-[#0E78AA] text-white' : active ? 'bg-[#0E78AA]/20 text-[#0E78AA]' : 'bg-slate-200'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
            </div>
            <span className="font-semibold text-[#094C6B]">{FLOW_LABEL[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
