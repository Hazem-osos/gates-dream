'use client';

import React from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { StatusBadge } from '@/components/ui';

type ReadinessIssue = {
  code: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

type ReadinessResponse = {
  ready: boolean;
  issues: ReadinessIssue[];
  payloadPreview?: { contentHash: string };
};

export function EtaReadinessPanel({
  invoiceId,
  isPosted,
}: {
  invoiceId: string | null | undefined;
  isPosted: boolean;
}) {
  const { data, isLoading } = useApiQuery<ReadinessResponse>(
    ['eta-readiness', invoiceId ?? ''],
    invoiceId ? `/eta/documents/validate/${invoiceId}` : '/eta/documents/queue',
    undefined,
    { enabled: !!invoiceId && isPosted }
  );

  const readiness = data?.data;

  if (!invoiceId || !isPosted) {
    return (
      <div className="rounded-lg border border-dashed border-[#D6EAF3] p-3 text-sm text-gray-500">
        جاهزية ETA: ترحّل الفاتورة أولاً لعرض متطلبات مصلحة الضرائب.
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-gray-600">جاري فحص جاهزية ETA...</p>;
  }

  if (!readiness) return null;

  return (
    <div className="rounded-lg border border-[#D6EAF3] p-4 bg-[#F6FBFD]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-bold text-[#0E78AA] text-sm">جاهزية الفاتورة الإلكترونية (ETA)</h3>
        {readiness.ready ? (
          <StatusBadge variant="success" label="جاهزة للإرسال" compact />
        ) : (
          <StatusBadge variant="danger" label="بيانات ناقصة" compact />
        )}
      </div>
      {readiness.payloadPreview?.contentHash && (
        <p className="text-xs text-gray-500 mb-2 font-mono truncate">
          Hash: {readiness.payloadPreview.contentHash}
        </p>
      )}
      <ul className="space-y-1">
        {readiness.issues.map((issue) => (
          <li
            key={`${issue.code}-${issue.field ?? ''}`}
            className={`text-xs ${issue.severity === 'error' ? 'text-red-700' : 'text-amber-800'}`}
          >
            {issue.message}
          </li>
        ))}
        {readiness.issues.length === 0 && (
          <li className="text-xs text-emerald-700">جميع متطلبات ETA مستوفاة.</li>
        )}
      </ul>
    </div>
  );
}
