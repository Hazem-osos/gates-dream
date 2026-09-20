'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { invalidateMasterDataQueries } from '@/lib/hooks/invalidateMasterData';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { setTenantContext } from '@/lib/tenant/tenant-context-storage';
import dynamic from 'next/dynamic';
import { DynamicChunkSkeleton } from '@/components/ui/DynamicChunkSkeleton';

const ExcelImporterStep = dynamic(
  () =>
    import('@/components/onboarding/ExcelImporterStep').then((m) => ({
      default: m.ExcelImporterStep,
    })),
  { ssr: false, loading: () => <DynamicChunkSkeleton label="جاري تحميل الاستيراد…" /> }
);
import { LogoFileUpload } from '@/components/onboarding/LogoFileUpload';
import {
  markOnboardingCompleteInCache,
  onboardingStatusQueryKey,
} from '@/lib/onboarding/onboarding-status-cache';
import { fetchApiQuery } from '@/lib/api/query-fetch';

type BusinessVertical =
  | 'TRADING'
  | 'CONTRACTING'
  | 'MANUFACTURING'
  | 'REAL_ESTATE'
  | 'SERVICES';

const STEPS = [
  'هوية الشركة',
  'طبيعة النشاط',
  'الفروع والمخازن',
  'استيراد البيانات',
  'انطلاق',
];

const VERTICAL_OPTIONS: {
  id: BusinessVertical;
  icon: string;
  title: string;
  hint: string;
}[] = [
  { id: 'TRADING', icon: '🛒', title: 'تجارة عامة وتجزئة', hint: 'Trading & Retail' },
  { id: 'CONTRACTING', icon: '🏗️', title: 'مقاولات واستشارات هندسية', hint: 'Contracting & BOQ' },
  { id: 'MANUFACTURING', icon: '🏭', title: 'تصنيع وإنتاج', hint: 'Manufacturing & Production' },
  { id: 'REAL_ESTATE', icon: '🏢', title: 'استثمار وتطوير عقاري', hint: 'Real Estate' },
  { id: 'SERVICES', icon: '💼', title: 'شركات خدمية واستيراد', hint: 'Services & Trading' },
];

const inputCls =
  'w-full py-2 px-3 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-right';

export default function OnboardingPage() {
  useBackendReachability();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateQuery = useInvalidateQuery();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importMode, setImportMode] = useState<'excel' | 'demo' | 'skip' | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [vertical, setVertical] = useState<BusinessVertical>('TRADING');
  const [company, setCompany] = useState({
    tradeNameAr: '',
    tradeNameEn: '',
    taxRegistrationNumber: '',
    commercialRegister: '',
    logoUrl: '',
    currencyCode: 'EGP',
  });
  const [branch, setBranch] = useState({
    arabicName: 'الفرع الرئيسي',
    warehouseName: 'مخزن الحركة',
    safeName: 'الخزينة الرئيسية',
  });
  const [bankHint, setBankHint] = useState('');

  const patchStep = useApiMutation<unknown, { step: number }>('/onboarding/step', 'PATCH');

  useEffect(() => {
    void patchStep.mutateAsync({ step: step + 1 }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync wizard progress only
  }, [step]);

  const bootstrap = useApiMutation<
    { branchId?: string; fiscalYearId?: string },
    Record<string, unknown>
  >('/onboarding/bootstrap', 'POST', {
    onSuccess: (res) => {
      const d = res.data;
      setTenantContext({
        branchId: d?.branchId ?? null,
        fiscalYearId: d?.fiscalYearId ?? null,
      });
      setBootstrapped(true);
      markOnboardingCompleteInCache(queryClient);
      invalidateMasterDataQueries(invalidateQuery);
      invalidateQuery(onboardingStatusQueryKey);
    },
    onError: (e) => setError(e.message),
  });

  const seedDemo = useApiMutation<unknown, void>('/onboarding/seed-demo', 'POST', {
    onSuccess: () => {
      setSuccess('تم تحميل بيانات تجريبية للاستكشاف');
      invalidateMasterDataQueries(invalidateQuery);
    },
    onError: (e) => setError(e.message),
  });

  const runBootstrapIfNeeded = async () => {
    if (bootstrapped || bootstrap.isPending) return true;
    if (!company.tradeNameAr.trim()) {
      setError('اسم المنشأة مطلوب');
      return false;
    }
    try {
      await bootstrap.mutateAsync({
        vertical,
        currencyCode: company.currencyCode,
        company: {
          tradeNameAr: company.tradeNameAr.trim(),
          tradeNameEn: company.tradeNameEn.trim() || null,
          taxRegistrationNumber: company.taxRegistrationNumber.trim() || null,
          commercialRegister: company.commercialRegister.trim() || null,
          logoUrl: company.logoUrl.trim() || null,
        },
        branch: {
          arabicName: branch.arabicName.trim(),
          warehouseName: branch.warehouseName.trim(),
          safeName: branch.safeName.trim(),
        },
        onboardingStep: step + 1,
      });
      return true;
    } catch {
      return false;
    }
  };

  const goLaunch = async () => {
    const ok = await runBootstrapIfNeeded();
    if (!ok) return;
    if (importMode === 'demo' && !seedDemo.isSuccess) {
      try {
        await seedDemo.mutateAsync(undefined as void);
      } catch {
        /* optional */
      }
    }
    setStep(4);
    void import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.65 } });
    });
  };

  const enterApp = async () => {
    markOnboardingCompleteInCache(queryClient);
    await queryClient.invalidateQueries({ queryKey: onboardingStatusQueryKey });
    try {
      await queryClient.fetchQuery({
        queryKey: [...onboardingStatusQueryKey, undefined],
        queryFn: ({ signal }) => fetchApiQuery('/onboarding/status', undefined, signal),
      });
    } catch {
      /* cache already marks complete after bootstrap */
    }
    router.replace('/dashboard?tour=1');
    router.refresh();
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#062A42] via-[#0E79AA] to-[#0A3D5E] p-4 md:p-8"
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto">
        {error && <ErrorToast message={error} onClose={() => setError('')} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

        <div className="mb-6">
          <div className="h-2 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/90 text-xs mt-2 text-center">
            الخطوة {step + 1} من {STEPS.length}: {STEPS[step]}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-10 shadow-xl min-h-[420px] flex flex-col">
          <h2 className="text-xl font-bold text-[#0E79AA] mb-6">{STEPS[step]}</h2>

          {step === 0 && (
            <div className="grid gap-4 flex-1">
              <label className="block">
                <span className="text-sm text-gray-600">اسم المنشأة (تجاري)</span>
                <input
                  className={inputCls}
                  value={company.tradeNameAr}
                  onChange={(e) => setCompany({ ...company, tradeNameAr: e.target.value })}
                />
              </label>
              <LogoFileUpload
                logoUrl={company.logoUrl}
                onLogoUrl={(url) => setCompany({ ...company, logoUrl: url })}
                onError={setError}
              />
              <label className="block">
                <span className="text-sm text-gray-600">الرقم الضريبي</span>
                <input
                  className={inputCls}
                  value={company.taxRegistrationNumber}
                  onChange={(e) =>
                    setCompany({ ...company, taxRegistrationNumber: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">السجل التجاري</span>
                <input
                  className={inputCls}
                  value={company.commercialRegister}
                  onChange={(e) =>
                    setCompany({ ...company, commercialRegister: e.target.value })
                  }
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2 flex-1">
              {VERTICAL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVertical(opt.id)}
                  className={`text-right rounded-xl border-2 p-4 transition ${
                    vertical === opt.id
                      ? 'border-[#0E79AA] bg-[#F0F9FC] shadow-md'
                      : 'border-[#D6EAF3] hover:border-[#0E79AA]/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{opt.icon}</div>
                  <div className="font-bold text-[#094C6B]">{opt.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{opt.hint}</div>
                </button>
              ))}
              <p className="sm:col-span-2 text-xs text-gray-500 leading-relaxed">
                عند اختيار النشاط نحمّل خلف الكواليس دليل حسابات مصري مع حسابات ضريبة القيمة المضافة 14٪
                وخصم المنبع 1٪ المناسبة لنشاطك.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 flex-1">
              <label className="block">
                <span className="text-sm text-gray-600">الفرع الرئيسي</span>
                <input
                  className={inputCls}
                  value={branch.arabicName}
                  onChange={(e) => setBranch({ ...branch, arabicName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">المخزن الرئيسي</span>
                <input
                  className={inputCls}
                  value={branch.warehouseName}
                  onChange={(e) => setBranch({ ...branch, warehouseName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">الخزينة الرئيسية (نقدية)</span>
                <input
                  className={inputCls}
                  value={branch.safeName}
                  onChange={(e) => setBranch({ ...branch, safeName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">حساب بنكي (اختياري — للإعداد لاحقاً)</span>
                <input
                  className={inputCls}
                  placeholder="مثال: البنك الأهلي — حساب جاري"
                  value={bankHint}
                  onChange={(e) => setBankHint(e.target.value)}
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 flex-1">
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setImportMode('excel')}
                  className={`rounded-xl border-2 p-3 text-sm font-medium ${
                    importMode === 'excel' ? 'border-[#0E79AA] bg-[#F0F9FC]' : 'border-[#D6EAF3]'
                  }`}
                >
                  📥 رفع ملف إكسيل
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('demo')}
                  className={`rounded-xl border-2 p-3 text-sm font-medium ${
                    importMode === 'demo' ? 'border-[#0E79AA] bg-[#F0F9FC]' : 'border-[#D6EAF3]'
                  }`}
                >
                  ⚡ بيانات تجريبية
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('skip')}
                  className={`rounded-xl border-2 p-3 text-sm font-medium ${
                    importMode === 'skip' ? 'border-[#0E79AA] bg-[#F0F9FC]' : 'border-[#D6EAF3]'
                  }`}
                >
                  ⏭️ تخطي — بداية فارغة
                </button>
              </div>
              {importMode === 'excel' ? (
                <>
                  {!bootstrapped ? (
                    <p className="text-amber-700 text-sm bg-amber-50 p-3 rounded-lg">
                      سيتم حفظ إعداد الشركة تلقائياً عند الاستيراد أو عند الانتقال للخطوة التالية.
                    </p>
                  ) : null}
                  <ExcelImporterStep
                    onImported={(s) => setSuccess(s)}
                    onError={(msg) => setError(msg)}
                  />
                </>
              ) : importMode === 'demo' ? (
                <p className="text-gray-600 text-sm leading-relaxed">
                  سنحمّل مجموعة أصناف وعملاء تجريبية بعد إتمام الإعداد لتجربة النظام بسرعة.
                </p>
              ) : importMode === 'skip' ? (
                <p className="text-gray-600 text-sm">يمكنك إضافة البيانات لاحقاً من لوحة التحكم.</p>
              ) : (
                <p className="text-gray-500 text-sm">اختر طريقة البدء المناسبة لك.</p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-6 flex-1 flex flex-col justify-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-[#094C6B] mb-2">شركتك جاهزة للانطلاق!</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                تم إعداد دليل الحسابات، الفرع، المخزن، والخزينة. جولة سريعة ستعرّفك على أهم
                اختصارات النظام.
              </p>
              <button
                type="button"
                onClick={() => void enterApp()}
                className="mx-auto px-10 py-3 bg-[#0E79AA] text-white rounded-xl font-bold text-lg shadow-lg hover:bg-[#0A3D5E]"
              >
                🚀 الدخول إلى النظام وبدء العمل
              </button>
            </div>
          )}

          {step < 4 && (
            <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="px-4 py-2 text-[#0E79AA] disabled:opacity-40"
              >
                السابق
              </button>
              <button
                type="button"
                disabled={bootstrap.isPending || seedDemo.isPending}
                onClick={() => {
                  if (step === 0) {
                    if (!company.tradeNameAr.trim()) {
                      setError('اسم المنشأة مطلوب');
                      return;
                    }
                    setStep(1);
                    return;
                  }
                  if (step === 1) {
                    setStep(2);
                    return;
                  }
                  if (step === 2) {
                    void runBootstrapIfNeeded().then((ok) => {
                      if (ok) setStep(3);
                    });
                    return;
                  }
                  if (step === 3) {
                    if (!importMode) {
                      setError('اختر طريقة استيراد البيانات أو التخطي');
                      return;
                    }
                    void goLaunch();
                  }
                }}
                className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg disabled:opacity-60"
              >
                {step === 2 && bootstrap.isPending
                  ? 'جاري التهيئة…'
                  : step === 3
                    ? 'إنهاء والانطلاق'
                    : 'التالي'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
