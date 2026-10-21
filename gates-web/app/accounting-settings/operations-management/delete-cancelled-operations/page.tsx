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
  DEFAULT_DELETE_CANCELLED_UNIT_IDS,
  DELETE_CANCELLED_UNITS,
  type DeleteCancelledUnitId,
} from '@/lib/operations/delete-cancelled-units';
import { DeleteCancelledScreenGate } from '@/components/operations/DeleteCancelledScreenGate';

type FiscalYearRow = {
  id: string;
  startDate: string;
  endDate: string;
  status?: string;
  code?: string;
};

type StatsResponse = {
  total: number;
  fromDate: string;
  toDate: string;
} & Record<DeleteCancelledUnitId, number>;

type RunPhase = 'idle' | 'backup' | 'delete';

function isoDateOnly(value: string | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function DeleteCancelledOperationsPage() {
  useBackendReachability();

  return (
    <>
      <AccountingSettingsPageHeader title="حذف العمليات الملغاة من قاعدة البيانات" />
      <DeleteCancelledScreenGate>
        {(gateToken) => <DeleteCancelledOperationsContent gateToken={gateToken} />}
      </DeleteCancelledScreenGate>
    </>
  );
}

function DeleteCancelledOperationsContent({ gateToken }: { gateToken: string }) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<DeleteCancelledUnitId>>(
    () => new Set(DEFAULT_DELETE_CANCELLED_UNIT_IDS)
  );
  const [runPhase, setRunPhase] = useState<RunPhase>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: fiscalYearsRes } = useApiQuery<FiscalYearRow[]>(
    ['company-fiscal-years', 'delete-cancelled'],
    '/company/fiscal-years',
    { page: 1, limit: 50 },
    { requireFullTenant: false, skipErrorNotify: true }
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

  const statsQueryKey = [
    'delete-cancelled-stats',
    fromDate,
    toDate,
    operationUnits.join(','),
  ] as const;

  const { data: statsRes, refetch: refetchStats } = useApiQuery<StatsResponse>(
    [...statsQueryKey, gateToken],
    '/operations-management/delete-cancelled-statistics',
    {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      operationUnits: operationUnits.length ? operationUnits.join(',') : undefined,
      gateToken,
    },
    {
      enabled: Boolean(openFiscalYear && fromDate && toDate && gateToken),
      skipErrorNotify: true,
    }
  );

  const delMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/delete-cancelled',
    'POST',
    {
      onSuccess: (res) => {
        setRunPhase('idle');
        setSuccess(res.message || 'تم الحذف');
        setError('');
        void refetchStats();
      },
      onError: (e: { message?: string }) => {
        setRunPhase('idle');
        setError(e?.message || 'فشل الحذف');
        setSuccess('');
      },
    }
  );

  useEffect(() => {
    if (openFrom && !fromDate) setFromDate(openFrom);
    if (openTo && !toDate) setToDate(openTo);
  }, [openFrom, openTo, fromDate, toDate]);

  const busy = runPhase !== 'idle' || delMutation.isPending;
  const stats = statsRes?.data;
  const eligibleTotal = stats?.total ?? null;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(DEFAULT_DELETE_CANCELLED_UNIT_IDS) : new Set());
  };

  const toggle = (id: DeleteCancelledUnitId) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allSelected = selected.size === DEFAULT_DELETE_CANCELLED_UNIT_IDS.length;

  const handleDelete = () => {
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
        setError(
          `${msg}. لا يمكن التنفيذ بدون نسخة. نزّل النسخة من «الإعدادات → النسخ الاحتياطي» ثم أعد المحاولة.`
        );
        return;
      }
      setRunPhase('delete');
      delMutation.mutate({
        operationUnits,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        gateToken,
        backupAcknowledged: true,
      });
    })();
  };

  const deleteLabel =
    runPhase === 'backup'
      ? 'جاري تنزيل النسخة…'
      : runPhase === 'delete' || delMutation.isPending
        ? 'جاري الحذف…'
        : 'حذف الملغى';

  return (
    <>
      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6 text-[#0A3D5E]">
            <p className="leading-7 text-sm">
              تُزال من القاعدة فقط المستندات <strong>الملغاة</strong> و<strong>غير المرحّلة</strong> داخل{' '}
              <strong>السنة المالية المفتوحة</strong>. المستندات المرحّلة، القيود المرتبطة بمصدر (فاتورة،
              مخزن، …)، والفواتير ذات تحصيل أو تسوية — لا تُحذف. يُنزَّل نسخة احتياطية تلقائياً قبل التنفيذ.
            </p>

            {openFiscalYear ? (
              <div className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-sm">
                السنة المفتوحة: من {openFrom} إلى {openTo}
                {openFiscalYear.code ? ` (${openFiscalYear.code})` : null}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                لا توجد سنة مالية مفتوحة.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="font-semibold shrink-0">من</label>
              <input
                type="date"
                min={openFrom || undefined}
                max={openTo || undefined}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={!openFiscalYear || busy}
                className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2 disabled:opacity-60"
              />
              <label className="font-semibold shrink-0">إلى</label>
              <input
                type="date"
                min={openFrom || undefined}
                max={openTo || undefined}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={!openFiscalYear || busy}
                className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2 disabled:opacity-60"
              />
              {eligibleTotal !== null ? (
                <span className="text-sm text-[#0E78AA] font-semibold">
                  جاهز للحذف في الفترة: {eligibleTotal} مستند
                </span>
              ) : null}
            </div>

            <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="text-[#0E78AA] font-bold">أنواع العمليات</div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={busy}
                    className="w-5 h-5 text-[#0E78AA] rounded"
                  />
                  <span>تحديد الكل</span>
                </label>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto">
                {DELETE_CANCELLED_UNITS.map((o) => (
                  <label key={o.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                      disabled={busy}
                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded shrink-0"
                    />
                    <span>
                      {o.label}
                      {stats && typeof stats[o.id] === 'number' && selected.has(o.id) ? (
                        <span className="text-[#0E78AA] mr-1">({stats[o.id]})</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={busy}
                className="px-6 py-3 rounded-xl bg-white border border-[#D6EAF3] text-[#0E78AA] hover:bg-[#F6FBFD] disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!openFiscalYear || busy || selected.size === 0}
                className="px-8 py-3 rounded-xl bg-[#0E78AA] text-white font-semibold hover:bg-[#0A3D5E] disabled:opacity-50"
              >
                {deleteLabel}
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
