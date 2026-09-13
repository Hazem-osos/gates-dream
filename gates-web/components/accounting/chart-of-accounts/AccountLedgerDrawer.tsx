'use client';

import { useMemo, useState } from 'react';
import {
  X,
  CalendarRange,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { Button } from '@/app/components/ui';
import { cn } from '@/lib/utils';

type StatementData = {
  account?: { id: string; code: string; arabicName: string };
  openingBalance?: number;
  closingBalance?: number;
  transactions: Array<{
    lineId?: string;
    entryDate: string;
    description?: string | null;
    debitBase: number;
    creditBase: number;
    runningBalance?: number;
    legacyGlNum?: string | null;
    sourceType?: string | null;
    sourceNumber?: string | null;
  }>;
};

const PERIOD_PRESETS = [
  { id: 'month', label: 'هذا الشهر' },
  { id: 'quarter', label: '3 أشهر' },
  { id: 'year', label: 'من بداية السنة' },
] as const;

function formatDateAr(iso: string) {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function defaultRange(preset: (typeof PERIOD_PRESETS)[number]['id']) {
  const end = new Date();
  let start: Date;
  if (preset === 'month') {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (preset === 'year') {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'debit' | 'credit' | 'balance';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    neutral: 'bg-slate-50 border-slate-200 text-slate-800',
    debit: 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900',
    credit: 'bg-rose-50/80 border-rose-200/80 text-rose-900',
    balance: 'bg-[#0E79AA]/10 border-[#0E79AA]/25 text-[#094C6B]',
  };
  return (
    <div className={cn('rounded-xl border p-3 min-w-0', tones[tone])}>
      <div className="flex items-center gap-2 text-[11px] font-medium opacity-80 mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums tracking-tight truncate">{value}</p>
    </div>
  );
}

export function AccountLedgerDrawer({
  accountId,
  accountLabel,
  open,
  onClose,
}: {
  accountId: string | null;
  accountLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<(typeof PERIOD_PRESETS)[number]['id']>('quarter');
  const [{ startDate, endDate }, setRange] = useState(() => defaultRange('quarter'));

  const applyPreset = (id: (typeof PERIOD_PRESETS)[number]['id']) => {
    setPreset(id);
    setRange(defaultRange(id));
  };

  const { data, isLoading, isError, refetch, isFetching } = useApiQuery<StatementData>(
    ['account-statement', accountId, startDate, endDate],
    accountId ? `/accounting/reports/account-statement/${accountId}` : '/accounting/reports/account-statement/_',
    { startDate, endDate },
    { enabled: open && !!accountId, staleTime: 30_000 }
  );

  const payload = data?.data;
  const lines = useMemo(() => payload?.transactions ?? [], [payload?.transactions]);
  const opening = payload?.openingBalance ?? 0;
  const closing = payload?.closingBalance ?? opening;

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += line.debitBase;
      credit += line.creditBase;
    }
    return { debit, credit };
  }, [lines]);

  const codeFromLabel = accountLabel.split('—')[0]?.trim() ?? '';
  const nameFromLabel = accountLabel.includes('—') ? accountLabel.split('—').slice(1).join('—').trim() : accountLabel;
  const accountCode = payload?.account?.code ?? codeFromLabel;
  const accountName = payload?.account?.arabicName ?? nameFromLabel;

  if (!accountId) return null;

  return (
    <CenteredOverlay open={open} onClose={onClose} width="xl" labelledBy="ledger-drawer-title">
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50" style={{ colorScheme: 'light' }}>
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-l from-[#0E79AA] to-[#094C6B] text-white px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white/80 mb-2 flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                كشف حساب
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white/15 border border-white/20 tabular-nums">
                  {accountCode}
                </span>
                <h2 id="ledger-drawer-title" className="text-lg font-bold truncate">
                  {accountName}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 hover:bg-white/10 transition-colors"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Period */}
          <div className="mt-4 rounded-xl bg-white/10 border border-white/15 p-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
                    preset === p.id ? 'bg-white text-[#094C6B]' : 'bg-white/10 text-white hover:bg-white/20'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CalendarRange className="h-4 w-4 text-white/70 shrink-0" aria-hidden />
              <label className="flex items-center gap-1.5">
                <span className="text-white/70">من</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPreset('quarter');
                    setRange((r) => ({ ...r, startDate: e.target.value }));
                  }}
                  className="rounded-md border border-white/25 bg-white/95 text-slate-800 px-2 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-white/70">إلى</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPreset('quarter');
                    setRange((r) => ({ ...r, endDate: e.target.value }));
                  }}
                  className="rounded-md border border-white/25 bg-white/95 text-slate-800 px-2 py-1 text-xs"
                />
              </label>
              {(isLoading || isFetching) && <Loader2 className="h-4 w-4 animate-spin text-white/80 ms-auto" />}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 bg-white border-b border-slate-200">
          <SummaryCard label="رصيد افتتاحي" value={formatMoney(opening)} tone="neutral" icon={Wallet} />
          <SummaryCard label="إجمالي مدين" value={formatMoney(totals.debit)} tone="debit" icon={ArrowDownLeft} />
          <SummaryCard label="إجمالي دائن" value={formatMoney(totals.credit)} tone="credit" icon={ArrowUpRight} />
          <SummaryCard label="رصيد ختامي" value={formatMoney(closing)} tone="balance" icon={TrendingUp} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white mx-4 my-3 rounded-xl border border-slate-200 shadow-sm">
          {isLoading && (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
              ))}
              <p className="text-center text-sm text-slate-500 pt-2">جاري تحميل الحركات…</p>
            </div>
          )}

          {isError && (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600 font-medium">تعذّر تحميل كشف الحساب</p>
              <p className="text-xs text-slate-500 mt-1">تحقق من صلاحيات التقارير أو اتصال الخادم.</p>
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => void refetch()}>
                إعادة المحاولة
              </Button>
            </div>
          )}

          {!isLoading && !isError && lines.length === 0 && (
            <div className="p-10 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <FileSpreadsheet className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">لا توجد حركات مرحّلة</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                لا توجد قيود في الفترة من {formatDateAr(startDate)} إلى {formatDateAr(endDate)}.
              </p>
            </div>
          )}

          {!isLoading && !isError && lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200">
                  <tr className="text-[11px] font-semibold text-slate-600">
                    <th className="text-start py-2.5 px-3 font-semibold">التاريخ</th>
                    <th className="text-start py-2.5 px-3 font-semibold">البيان</th>
                    <th className="text-end py-2.5 px-3 font-semibold whitespace-nowrap">مدين</th>
                    <th className="text-end py-2.5 px-3 font-semibold whitespace-nowrap">دائن</th>
                    <th className="text-end py-2.5 px-3 font-semibold whitespace-nowrap">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50/80 text-xs text-slate-600 border-b border-slate-100">
                    <td className="py-2 px-3" colSpan={2}>
                      رصيد افتتاحي قبل {formatDateAr(startDate)}
                    </td>
                    <td className="py-2 px-3 text-end tabular-nums">—</td>
                    <td className="py-2 px-3 text-end tabular-nums">—</td>
                    <td className="py-2 px-3 text-end tabular-nums font-semibold text-slate-800">
                      {formatMoney(opening)}
                    </td>
                  </tr>
                  {lines.map((line, i) => (
                    <tr
                      key={line.lineId ?? `${line.entryDate}-${i}`}
                      className="border-b border-slate-50 hover:bg-[#0E79AA]/[0.03] transition-colors"
                    >
                      <td className="py-2.5 px-3 align-top whitespace-nowrap text-slate-600 text-xs">
                        {formatDateAr(String(line.entryDate))}
                        {line.legacyGlNum ? (
                          <span className="block text-[10px] text-slate-400 mt-0.5">#{line.legacyGlNum}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 align-top text-slate-800 max-w-[200px]">
                        <span className="line-clamp-2">{line.description || '—'}</span>
                        {line.sourceNumber ? (
                          <span className="text-[10px] text-slate-400 block mt-0.5">{line.sourceNumber}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums text-emerald-700 font-medium whitespace-nowrap">
                        {line.debitBase > 0 ? formatMoney(line.debitBase) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums text-rose-700 font-medium whitespace-nowrap">
                        {line.creditBase > 0 ? formatMoney(line.creditBase) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatMoney(line.runningBalance ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-semibold">
                  <tr>
                    <td className="py-2.5 px-3 text-slate-600" colSpan={2}>
                      الإجمالي / الرصيد الختامي
                    </td>
                    <td className="py-2.5 px-3 text-end text-emerald-800 tabular-nums">{formatMoney(totals.debit)}</td>
                    <td className="py-2.5 px-3 text-end text-rose-800 tabular-nums">{formatMoney(totals.credit)}</td>
                    <td className="py-2.5 px-3 text-end text-[#094C6B] tabular-nums">{formatMoney(closing)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <footer className="shrink-0 flex gap-2 p-4 bg-white border-t border-slate-200">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            إغلاق
          </Button>
        </footer>
      </div>
    </CenteredOverlay>
  );
}
