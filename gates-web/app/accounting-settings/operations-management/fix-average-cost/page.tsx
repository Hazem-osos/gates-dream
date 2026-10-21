'use client';

import { AccountingSettingsPageHeader } from '@/components/accounting-settings';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiMutation } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { downloadTenantJsonBackup } from '@/lib/company/download-tenant-backup';
import { useOpenFiscalYearRepair } from '@/lib/operations/use-open-fiscal-year-repair';

type RunPhase = 'idle' | 'backup' | 'fix';

export default function FixAverageCostPage() {
  useBackendReachability();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [runPhase, setRunPhase] = useState<RunPhase>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    openFiscalYear,
    openFrom,
    openTo,
    recalculateFromDate,
    setRecalculateFromDate,
    recalculateToDate,
    setRecalculateToDate,
  } = useOpenFiscalYearRepair('fix-average-cost');

  const fixMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/fix-average-cost',
    'POST',
    {
      onSuccess: (res) => {
        setRunPhase('idle');
        setConfirmOpen(false);
        setSuccess(res.message || 'تم إصلاح متوسط التكلفة');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setRunPhase('idle');
        setError(e?.message || 'فشل الطلب');
        setSuccess('');
      },
    }
  );

  const busy = runPhase !== 'idle' || fixMutation.isPending;

  const openConfirm = () => {
    if (!openFiscalYear) {
      setError('لا توجد سنة مالية مفتوحة. السنوات المغلقة مستثناة.');
      return;
    }
    if (!recalculateFromDate || !recalculateToDate) {
      setError('حدد من تاريخ وإلى تاريخ');
      return;
    }
    setError('');
    setSuccess('');
    setConfirmOpen(true);
  };

  const confirm = () => {
    void (async () => {
      setRunPhase('backup');
      try {
        await downloadTenantJsonBackup();
      } catch (err) {
        setRunPhase('idle');
        const msg = err instanceof Error ? err.message : 'تعذر تنزيل النسخة الاحتياطية';
        setError(
          `${msg}. لا يمكن تشغيل الإصلاح بدون نسخة. إن لم يكن حسابك مالك المنظومة، نزّل النسخة من ` +
            '«الإعدادات → النسخ الاحتياطي» ثم أعد المحاولة، أو اطلب من المالك تشغيل الشاشة.'
        );
        return;
      }
      setRunPhase('fix');
      fixMutation.mutate({
        recalculateFromDate,
        recalculateToDate,
        repairScope: 'average_cost',
        backupAcknowledged: true,
      });
    })();
  };

  const activateLabel =
    runPhase === 'backup'
      ? 'جاري تنزيل النسخة…'
      : runPhase === 'fix' || fixMutation.isPending
        ? 'جاري إعادة الاحتساب…'
        : 'تفعيل';

  return (
    <>
      <AccountingSettingsPageHeader title="إصلاح متوسط التكلفة" />
      <OuterCard>
        <InnerCard>
          <div className="p-6 text-[#0A3D5E] space-y-5">
            <p className="leading-7">
              إعادة تشغيل حركات المخزون داخل الفترة لتحديث <strong>متوسط التكلفة المرجّح</strong>{' '}
              على مستوى الصنف والمخزن. لا يعدّل هذه الشاشة قيود اليومية — لتصحيح القيود بعد
              الاحتساب استخدم{' '}
              <Link
                href="/accounting-settings/operations-management/fix-inventory-journals"
                className="text-[#0E78AA] underline"
              >
                اصلاح قيود المخزون
              </Link>
              .
            </p>

            {openFiscalYear ? (
              <div className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-sm">
                السنة المفتوحة: من {openFrom} إلى {openTo}
                {openFiscalYear.code ? ` (${openFiscalYear.code})` : null}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                لا توجد سنة مالية مفتوحة. افتح سنة مالية قبل تشغيل الإصلاح.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 max-w-2xl">
              <label className="font-semibold shrink-0">من تاريخ</label>
              <input
                type="date"
                required
                min={openFrom || undefined}
                max={openTo || undefined}
                value={recalculateFromDate}
                onChange={(e) => setRecalculateFromDate(e.target.value)}
                disabled={!openFiscalYear || busy}
                className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-2 disabled:opacity-60"
              />
              <label className="font-semibold shrink-0">إلى تاريخ</label>
              <input
                type="date"
                required
                min={openFrom || undefined}
                max={openTo || undefined}
                value={recalculateToDate}
                onChange={(e) => setRecalculateToDate(e.target.value)}
                disabled={!openFiscalYear || busy}
                className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-2 disabled:opacity-60"
              />
            </div>

            <div className="rounded-xl border border-[#E6F0F7] bg-white p-4 space-y-2 text-sm leading-6 text-slate-600">
              <p>
                العملية قد تستغرق وقتاً على الشركات الكبيرة. السنوات المالية <strong>المغلقة</strong>{' '}
                لا تُعاد كتابتها.
              </p>
              <p>
                قبل التشغيل تُنزَّل نسخة احتياطية على جهازك. نسخة يدوية؟{' '}
                <Link href="/settings/backup" className="text-[#0E78AA] underline">
                  الإعدادات → النسخ الاحتياطي
                </Link>
              </p>
            </div>

            <div className="flex justify-end">
              <ActionButtons
                onCancel={() => router.back()}
                onSave={openConfirm}
                saveText={activateLabel}
                saveDisabled={!openFiscalYear || busy}
                saveLoading={busy}
                cancelDisabled={busy}
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl w-[680px] max-w-[90%] shadow-xl border border-[#D6EAF3]">
            <div className="px-6 py-4 border-b border-[#E6F0F7] text-center font-bold text-[#0A3D5E]">
              إصلاح متوسط التكلفة
            </div>
            <div className="px-6 py-6 text-center text-[#0A3D5E] space-y-2 text-sm leading-7">
              <p>
                سيتم أولاً تنزيل نسخة احتياطية، ثم إعادة احتساب متوسط التكلفة من حركات المخزون
                للفترة المحددة. القيود المحاسبية المرحّلة لا تُعدَّل في هذه الخطوة.
              </p>
              <p>
                النطاق: من {recalculateFromDate || '—'} إلى {recalculateToDate || '—'}. السنوات
                المغلقة لا تُمس.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-center gap-4 border-t border-[#E6F0F7]">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                className="px-10 py-3 rounded-xl bg-[#2C6FE4] text-white hover:opacity-95 transition-all disabled:opacity-60"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="px-10 py-3 rounded-xl bg-[#20B26B] text-white hover:opacity-95 transition-all disabled:opacity-60"
              >
                {activateLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </>
  );
}
