'use client';

import React from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';

export type DocumentEntityType = 'INVOICE' | 'JOURNAL_ENTRY' | 'STOCK_MOVEMENT';

export interface DocumentAuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  message: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function DocumentActivityLog({
  entityType,
  entityId,
  title = 'سجل النشاط',
}: {
  entityType: DocumentEntityType;
  entityId: string | null | undefined;
  title?: string;
}) {
  const { data, isLoading, isError } = useApiQuery<DocumentAuditEntry[]>(
    ['document-audit', entityType, entityId ?? ''],
    '/audit/logs',
    entityId ? { entityType, entityId, limit: 50 } : undefined,
    { enabled: !!entityId }
  );

  const entries = data?.data ?? [];

  if (!entityId) {
    return (
      <section className="mt-6 border-t border-[#D6EAF3] pt-4">
        <h3 className="text-[#0E78AA] font-bold mb-2">{title}</h3>
        <p className="text-sm text-gray-500">احفظ المستند لعرض سجل النشاط.</p>
      </section>
    );
  }

  return (
    <section className="mt-6 border-t border-[#D6EAF3] pt-4">
      <h3 className="text-[#0E78AA] font-bold mb-3">{title}</h3>
      {isLoading && <p className="text-sm text-gray-600">جاري تحميل السجل...</p>}
      {isError && <p className="text-sm text-red-600">تعذر تحميل سجل النشاط</p>}
      {!isLoading && entries.length === 0 && (
        <p className="text-sm text-gray-500">لا توجد أحداث مسجّلة بعد.</p>
      )}
      <ol className="relative border-r-2 border-[#D6EAF3] mr-3 space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="mr-4 pr-2">
            <span className="absolute -right-[7px] mt-1.5 h-3 w-3 rounded-full bg-[#0E78AA]" />
            <p className="text-sm text-gray-900">
              {entry.message ?? `${entry.userName} — ${entry.action}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{formatWhen(entry.createdAt)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
