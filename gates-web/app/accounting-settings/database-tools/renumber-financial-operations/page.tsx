'use client';
import { AccountingSettingsPageHeader } from '@/components/accounting-settings';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { downloadTenantJsonBackup } from '@/lib/company/download-tenant-backup';
import {
  DEFAULT_RENUMBER_INPUT_UNIT_IDS,
  RENUMBER_INPUT_UNITS,
  type RenumberInputUnitId,
} from '@/lib/operations/renumber-input-units';

type FiscalYearRow = {
  id: string;
  startDate: string;
  endDate: string;
  status?: string;
  code?: string;
};

type StatsResponse = { total: number; fromDate: string; toDate: string } & Record<
  RenumberInputUnitId,
  number
>;

type RunPhase = 'idle' | 'backup' | 'renumber';

function isoDateOnly(value: string | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function RenumberFinancialOperationsPage() {
  useBackendReachability();

  const router = useRouter();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<RenumberInputUnitId>>(
    () => new Set(DEFAULT_RENUMBER_INPUT_UNIT_IDS)
  );
  const [runPhase, setRunPhase] = useState<RunPhase>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: fiscalYearsRes } = useApiQuery<FiscalYearRow[]>(
    ['company-fiscal-years', 'renumber-ops'],
    '/company/fiscal-years',
    { page: 1, limit: 50 }
  );

  const openFiscalYear = useMemo(() => {
    const rows = Array.isArray(fiscalYearsRes?.data) ? fiscalYearsRes.data : [];
    const openRows = rows.filter((y) => (y.status ?? '').toLowerCase() !== 'close');
    const today = new Date().toISOString().slice(0, 10);
    const covering = openRows.find((y) => {
      const from = isoDateOnly(y.startDate);
      const to = isoDateOnly(y.endDate);
      return from && to && from <= today && to >= today;
    });
    if (covering) return covering;
    return openRows.sort((a, b) => isoDateOnly(b.startDate).localeCompare(isoDateOnly(a.startDate)))[0];
  }, [fiscalYearsRes?.data]);

  const openFrom = isoDateOnly(openFiscalYear?.startDate);
  const openTo = isoDateOnly(openFiscalYear?.endDate);
  const operationUnits = useMemo(() => Array.from(selected), [selected]);

  const { data: statsRes, refetch: refetchStats } = useApiQuery<StatsResponse>(
    ['renumber-ops-stats', fromDate, toDate, operationUnits.join(',')],
    '/database-tools/renumber-operations-statistics',
    {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      operationUnits: operationUnits.length ? operationUnits.join(',') : undefined,
    },
    { enabled: Boolean(openFiscalYear && fromDate && toDate) }
  );

  const renumberMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/renumber-operations',
    'POST',
    {
      onSuccess: (res) => {
        setRunPhase('idle');
        setSuccess(res.message || 'تم إعادة الترقيم');
        setError('');
        void refetchStats();
      },
      onError: (e: { message?: string }) => {
        setRunPhase('idle');
        setError(e?.message || 'فشل إعادة الترقيم');
        setSuccess('');
      },
    }
  );

  useEffect(() => {
    if (openFrom && !fromDate) setFromDate(openFrom);
    if (openTo && !toDate) setToDate(openTo);
  }, [openFrom, openTo, fromDate, toDate]);

  const busy = runPhase !== 'idle' || renumberMutation.isPending;
  const stats = statsRes?.data;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(DEFAULT_RENUMBER_INPUT_UNIT_IDS) : new Set());
  };

  const toggle = (id: RenumberInputUnitId) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allSelected = selected.size === DEFAULT_RENUMBER_INPUT_UNIT_IDS.length;

  const handleConfirm = () => {
    if (!openFiscalYear) {
      setError('لا توجد سنة مالية مفتوحة');
      return;
    }
    if (selected.size === 0) {
      setError('اختر نوعاً واحداً على الأقل');
      return;
    }
    setError('');
    setSuccess('');
    void (async () => {
      setRunPhase('backup');
      try {
        await downloadTenantJsonBackup();
      } catch (err) {
        setRunPhase('idle');
        const msg = err instanceof Error ? err.message : 'تعذر تنزيل النسخة الاحتياطية';
        setError(`${msg}. لا يمكن التنفيذ بدون نسخة احتياطية.`);
        return;
      }
      setRunPhase('renumber');
      renumberMutation.mutate({
        operationUnits,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        backupAcknowledged: true,
      });
    })();
  };

  const confirmLabel =
    runPhase === 'backup'
      ? 'جاري تنزيل النسخة…'
      : runPhase === 'renumber' || renumberMutation.isPending
        ? 'جاري إعادة الترقيم…'
        : 'تأكيد إعادة الترقيم';

  return (
    <>
      <AccountingSettingsPageHeader title="إعادة ترقيم وحدات الإدخال" />
      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6 text-[#0A3D5E]">
            <p className="text-sm leading-7">
              يعيد ترقيم المستندات <strong>غير المرحّلة</strong> و<strong>غير الملغاة</strong> في{' '}
              <strong>السنة المفتوحة</strong> فقط، حسب إعدادات كل شاشة:{' '}
              <strong>ترقيم منفصل</strong> (يبدأ من بداية السنة / SerialStart) أو{' '}
              <strong>متصل</strong> (يكمل بعد آخر رقم في السنة السابقة). يُنزَّل backup قبل التنفيذ.
              المرحّل والترقيم اليدوي لا يُعاد ترقيمهما.
            </p>

            {openFiscalYear ? (
              <div className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-sm">
                السنة المفتوحة: {openFrom} → {openTo}
                {openFiscalYear.code ? ` (${openFiscalYear.code})` : null}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                لا توجد سنة مالية مفتوحة.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="font-semibold">من</label>
              <input
                type="date"
                min={openFrom || undefined}
                max={openTo || undefined}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={!openFiscalYear || busy}
                className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2 disabled:opacity-60"
              />
              <label className="font-semibold">إلى</label>
              <input
                type="date"
                min={openFrom || undefined}
                max={openTo || undefined}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={!openFiscalYear || busy}
                className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2 disabled:opacity-60"
              />
              {stats ? (
                <span className="text-sm font-semibold text-[#0E78AA]">
                  مستندات غير مرحّلة في الفترة: {stats.total}
                </span>
              ) : null}
            </div>

            <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4">
              <div className="flex flex-wrap justify-between gap-3 mb-3">
                <div className="text-[#0E78AA] font-bold">وحدات الإدخال</div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={busy}
                    className="w-5 h-5 rounded"
                  />
                  تحديد الكل
                </label>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto text-sm">
                {RENUMBER_INPUT_UNITS.map((u) => (
                  <label key={u.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                      disabled={busy}
                      className="w-5 h-5 shrink-0"
                    />
                    <span>
                      {u.label}
                      {stats && selected.has(u.id) && typeof stats[u.id] === 'number' ? (
                        <span className="text-[#0E78AA] mr-1">({stats[u.id]})</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={busy}
                className="px-6 py-3 rounded-xl border border-[#D6EAF3] bg-white text-[#0E78AA] disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!openFiscalYear || busy || selected.size === 0}
                className="px-8 py-3 rounded-xl bg-[#0E78AA] text-white font-semibold disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </>
  );
}
