'use client';

import React, { useState } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { usePartyQuickSummary } from '@/lib/hooks/usePartyQuickSummary';

type Props = {
  partyId: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  label: string;
  children: React.ReactNode;
};

const badgeTone: Record<string, string> = {
  regular: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  credit_exceeded: 'bg-red-50 text-red-800 border-red-200',
  late_payment: 'bg-amber-50 text-amber-900 border-amber-200',
};

export function PartyHoverCard({ partyId, partyType, label, children }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = usePartyQuickSummary(partyId, partyType, open);
  const summary = data?.data;

  return (
    <HoverCard.Root openDelay={280} closeDelay={120} onOpenChange={setOpen}>
      <HoverCard.Trigger asChild>
        <span className="inline-flex max-w-full cursor-help border-b border-dotted border-sky-400/60">
          {children}
        </span>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-[200] w-[min(320px,90vw)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl text-right"
          dir="rtl"
        >
          <p className="text-xs font-semibold text-sky-700 mb-1">{label}</p>
          <p className="text-sm font-bold text-slate-900 truncate">{summary?.displayName ?? '…'}</p>
          {summary?.code ? (
            <p className="text-[11px] text-slate-500 mt-0.5">كود: {summary.code}</p>
          ) : null}

          {isLoading ? (
            <p className="text-xs text-slate-500 mt-3">جاري التحميل…</p>
          ) : summary ? (
            <div className="mt-3 space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between gap-2">
                <span>الرصيد الحالي</span>
                <span className="font-semibold tabular-nums">
                  {summary.balance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {summary.creditLimit != null ? (
                <div>
                  <div className="flex justify-between mb-1">
                    <span>حد الائتمان</span>
                    <span className="tabular-nums">{summary.creditLimit.toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all"
                      style={{ width: `${summary.creditUsedPercent ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {summary.phone ? (
                <div className="flex justify-between gap-2">
                  <span>الهاتف</span>
                  <span dir="ltr" className="font-medium">
                    {summary.phone}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <span>فواتير مفتوحة</span>
                <span className="font-semibold">{summary.openInvoicesCount}</span>
              </div>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  badgeTone[summary.riskBadge] ?? badgeTone.regular
                }`}
              >
                {summary.riskLabelAr}
              </span>
            </div>
          ) : (
            <p className="text-xs text-red-600 mt-2">تعذر تحميل الملخص</p>
          )}
          <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
