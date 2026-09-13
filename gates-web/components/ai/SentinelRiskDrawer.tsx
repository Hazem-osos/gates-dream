'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, X } from 'lucide-react';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { localizeApiErrorMessage } from '@/lib/api/api-error-notify';
import {
  useSentinelExecutiveReport,
  type SentinelSeverity,
} from '@/lib/hooks/useSentinelExecutiveReport';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { DASH_NUM, DASH_PANEL } from '@/components/dashboard-primitives';

type Props = {
  open: boolean;
  onClose: () => void;
};

function severityClass(severity: SentinelSeverity) {
  if (severity === 'crit') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (severity === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function InspectLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-[11px] font-semibold text-[#0E79AA] underline-offset-2 hover:underline"
    >
      فحص الحركة
    </Link>
  );
}

export function SentinelRiskDrawer({ open, onClose }: Props) {
  const { report, isLoading, isError, error, refetch, isFetching } = useSentinelExecutiveReport(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const fraudCards = [
    ...(report?.fraud.voidPatterns ?? []).map((row) => ({
      id: `void-${row.userId}`,
      severity: row.severity,
      title: row.userName,
      detail: `إلغاء ${Math.round(row.voidRate * 10000) / 100}% من الحجم (${row.cancelledCount} من ${row.totalCount}) — ملغى ${formatMoney(row.cancelledVolume)}`,
      href: row.inspectHref,
    })),
    ...(report?.fraud.backdated ?? []).map((row) => ({
      id: `back-${row.invoiceId}`,
      severity: row.severity,
      title: `فاتورة بتاريخ سابق ${row.invoiceNumber}`,
      detail: `${row.lagDays} يوم بين تاريخ الفاتورة ${row.invoiceDate} وتسجيل ${row.userName}`,
      href: row.inspectHref,
    })),
    ...(report?.fraud.shortages ?? []).map((row) => ({
      id: `short-${row.itemId}`,
      severity: row.severity,
      title: row.itemName,
      detail: `${row.eventCount} تسوية عجز خلال ${row.windowDays} يوماً — كمية ${row.totalShortageQty}`,
      href: row.inspectHref,
    })),
  ];

  const replacement = report?.replacement ?? [];
  const projects = report?.cashflow.projects ?? [];
  const companyGap = report?.cashflow.companyGap ?? 0;

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="sentinel-drawer-title">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-l from-[#0A3D56] to-[#0E79AA] px-5 py-3.5 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="sentinel-drawer-title" className="truncate text-sm font-bold leading-tight">
              رادار الرقابة والمخاطر
            </h2>
            <p className="truncate text-[11px] text-white/75">
              تقرير الرقابة الداخلية ودرع السيولة
              {report?.asOf ? ` · ${report.asOf}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 text-[11px] text-white hover:bg-white/15 disabled:opacity-60"
            disabled={isFetching}
          >
            تحديث
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] p-5">
        {isLoading && !report ? (
          <p className="text-sm text-slate-500">جاري تحليل الرقابة…</p>
        ) : null}
        {isError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
            تعذّر تحميل تقرير الرقابة.
            {error?.message
              ? ` ${localizeApiErrorMessage(error.message, Number.parseInt(error.code ?? '', 10) || undefined)}`
              : ''}
          </p>
        ) : null}

        {report?.narrative ? (
          <section className={`${DASH_PANEL} whitespace-pre-line p-3 text-[12px] leading-6 text-slate-700`}>
            {report.narrative}
          </section>
        ) : null}

        <section>
          <h3 className="mb-2 text-xs font-bold text-slate-900">كشف الشبهات والتلاعب</h3>
          {fraudCards.length === 0 ? (
            <p className={`${DASH_PANEL} p-3 text-[12px] text-slate-500`}>
              لا توجد شبهات إلغاء أو قيود بتاريخ سابق أو تسويات عجز متكررة.
            </p>
          ) : (
            <div className="space-y-2">
              {fraudCards.map((card) => (
                <article key={card.id} className={`rounded-xl border px-3 py-2.5 ${severityClass(card.severity)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-[13px] font-semibold">{card.title}</p>
                    <InspectLink href={card.href} />
                  </div>
                  <p className="mt-1 text-[11px] opacity-90">{card.detail}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold text-slate-900">تنبيهات تكلفة الإحلال</h3>
          {replacement.length === 0 ? (
            <p className={`${DASH_PANEL} p-3 text-[12px] text-slate-500`}>
              لا توجد أصناف تُباع دون تكلفة الإحلال خلال 7 أيام.
            </p>
          ) : (
            <div className={`${DASH_PANEL} overflow-x-auto`}>
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-start font-medium">الصنف</th>
                    <th className="px-2 py-2 text-start font-medium">البيع</th>
                    <th className="px-2 py-2 text-start font-medium">الإحلال</th>
                    <th className="px-2 py-2 text-start font-medium">المقترح</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {replacement.map((row) => (
                    <tr key={`${row.invoiceId}-${row.itemId}`} className="border-t border-slate-100">
                      <td className="px-2 py-2">
                        <p className="font-semibold text-slate-800">{row.itemName}</p>
                        <p className="text-[10px] text-slate-400">{row.invoiceNumber}</p>
                      </td>
                      <td className={`px-2 py-2 ${DASH_NUM}`}>{formatMoney(row.salePrice)}</td>
                      <td className={`px-2 py-2 ${DASH_NUM}`}>{formatMoney(row.replacementCost)}</td>
                      <td className={`px-2 py-2 font-semibold text-[#0E79AA] ${DASH_NUM}`}>
                        {formatMoney(row.suggestedSalePrice)}
                      </td>
                      <td className="px-2 py-2">
                        <InspectLink href={row.inspectHref} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold text-slate-900">موقف سيولة المقاولات</h3>
          <div className={`${DASH_PANEL} p-3`}>
            <div className="mb-2 flex items-end justify-between gap-2">
              <p className="text-[11px] text-slate-500">فجوة الشركة خلال {report?.cashflow.horizonDays ?? 21} يوماً</p>
              <p className={`text-lg font-bold ${companyGap > 0 ? 'text-rose-700' : 'text-emerald-700'} ${DASH_NUM}`}>
                {formatMoney(companyGap)}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${companyGap > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (Math.abs(companyGap) / Math.max(report?.cashflow.totalSubcontractorDue21d ?? 1, 1)) * 100
                    )
                  )}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              مقاولون {formatMoney(report?.cashflow.totalSubcontractorDue21d ?? 0)} · مالك{' '}
              {formatMoney(report?.cashflow.totalOwnerInflow21d ?? 0)} · سيولة{' '}
              {formatMoney(report?.cashflow.liquidTotal ?? 0)}
            </p>
          </div>
          {projects.length === 0 ? (
            <p className="mt-2 text-[12px] text-slate-500">لا مشاريع معرضة لعجز قد يسبب غرامات تأخير.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {projects.map((row) => (
                <article key={row.projectId} className={`rounded-xl border px-3 py-2.5 ${severityClass(row.severity)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[13px] font-semibold">
                      {row.projectName}{' '}
                      <span className="font-mono text-[10px] opacity-70">{row.projectCode}</span>
                    </p>
                    <InspectLink href={row.inspectHref} />
                  </div>
                  <p className="mt-1 text-[11px]">
                    فجوة {formatMoney(row.gap)} — مستحقات مقاول {formatMoney(row.subcontractorDue21d)} مقابل مستخلص مالك{' '}
                    {formatMoney(row.ownerInflow21d)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </CenteredOverlay>
  );
}
