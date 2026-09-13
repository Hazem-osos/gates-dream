'use client';

import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import type { AiInsight } from '@/lib/ai/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 18) return 'مساء الخير';
  return 'مساء الخير';
}

export function InsightBriefingCard({
  insights,
  onDismiss,
}: {
  insights: AiInsight[];
  onDismiss: (id: string) => void;
}) {
  const alerts = insights.filter((row) => row.severity === 'CRITICAL' || row.severity === 'WARNING');
  if (!alerts.length) return null;
  const hasCritical = alerts.some((row) => row.severity === 'CRITICAL');

  return (
    <section
      className={`mb-3 rounded-xl border px-3 py-2.5 text-right ${
        hasCritical ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${hasCritical ? 'text-rose-600' : 'text-amber-600'}`} />
        <p className={`text-xs font-semibold ${hasCritical ? 'text-rose-800' : 'text-amber-900'}`}>
          {greeting()}، هناك {alerts.length} تنبيهات مالية تتطلب انتباهك اليوم:
        </p>
      </div>
      <ul className="space-y-2">
        {alerts.map((insight) => (
          <li
            key={insight.id}
            className="rounded-lg border border-white/70 bg-white/80 px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[#094C6B]">{insight.title}</p>
                <p className="mt-0.5 line-clamp-3 text-[11px] leading-5 text-slate-600">{insight.summary}</p>
                {insight.actionLink ? (
                  <Link
                    href={insight.actionLink}
                    className="mt-1 inline-block text-[11px] font-semibold text-[#0E79AA] hover:underline"
                  >
                    عرض التفاصيل
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(insight.id)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="تجاهل"
                aria-label="تجاهل"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
