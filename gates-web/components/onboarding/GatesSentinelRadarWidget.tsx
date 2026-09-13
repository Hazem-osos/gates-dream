'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSentinelAlerts,
  type SentinelAlert,
} from '@/lib/hooks/useSentinelAlerts';

function levelStyles(level: SentinelAlert['level']) {
  if (level === 'crit') return 'border-rose-300 bg-rose-50 text-rose-900';
  if (level === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-sky-200 bg-sky-50 text-sky-900';
}

function AlertRow({
  alert,
  expanded,
  onToggle,
  onNavigate,
}: {
  alert: SentinelAlert;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
}) {
  const hasDetail = Boolean(alert.detail || alert.href);
  return (
    <li>
      <button
        type="button"
        disabled={!hasDetail}
        onClick={() => {
          if (alert.href) onNavigate(alert.href);
          else if (alert.detail) onToggle();
        }}
        className={`w-full text-right text-xs leading-relaxed rounded-lg px-3 py-2 border transition-colors ${levelStyles(alert.level)} ${
          hasDetail ? 'cursor-pointer hover:brightness-[0.98]' : 'cursor-default'
        }`}
      >
        <span className="font-medium">{alert.text}</span>
        {expanded && alert.detail ? (
          <p className="mt-1.5 text-[11px] opacity-90 font-normal">{alert.detail}</p>
        ) : null}
        {hasDetail && !alert.href ? (
          <span className="block mt-1 text-[10px] opacity-70">
            {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </span>
        ) : null}
        {alert.href ? (
          <span className="block mt-1 text-[10px] opacity-70">فتح السجل ←</span>
        ) : null}
      </button>
    </li>
  );
}

/** Dashboard widget — training alerts from API; live mode when Sentinel engine is enabled on server. */
export function GatesSentinelRadarWidget() {
  const router = useRouter();
  const { alerts, mode, payload, isLoading, isFetching, refetch } = useSentinelAlerts();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isTraining = mode === 'training';

  return (
    <div
      data-tour="sentinel-radar"
      className="mb-6 rounded-2xl border border-rose-200/80 bg-gradient-to-l from-rose-50 via-white to-orange-50/40 p-4 shadow-sm"
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xl" aria-hidden>
          🛡️
        </span>
        <h2 className="text-base font-bold text-slate-900">رادار الأمان — Sentinel</h2>
        <span
          className={`mr-auto text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full ${
            isTraining
              ? 'text-amber-800 bg-amber-100'
              : 'uppercase text-rose-600 bg-rose-100'
          }`}
        >
          {isTraining ? 'تدريب' : 'Live'}
        </span>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 px-2 py-0.5 rounded border border-slate-200 bg-white"
          aria-label="تحديث التنبيهات"
        >
          {isFetching ? '…' : 'تحديث'}
        </button>
      </div>

      {isLoading && !payload ? (
        <p className="text-xs text-slate-500 py-2">جاري تحميل الرادار…</p>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-slate-600 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
          لا توجد تنبيهات رقابية حالياً.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              expanded={expandedId === a.id}
              onToggle={() => setExpandedId((id) => (id === a.id ? null : a.id))}
              onNavigate={(href) => router.push(href)}
            />
          ))}
        </ul>
      )}

      {isTraining ? (
        <p className="text-[11px] text-slate-500 mt-3">
          تنبيهات تجريبية للتدريب — تُربط بمحرك الرقابة عند تفعيل Sentinel في الإنتاج.
        </p>
      ) : payload?.updatedAt ? (
        <p className="text-[11px] text-slate-500 mt-3">
          آخر مسح: {new Date(payload.updatedAt).toLocaleString('ar-EG')}
        </p>
      ) : null}
    </div>
  );
}
