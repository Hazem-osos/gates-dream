'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Settings } from 'lucide-react';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { Button } from '@/components/ui/button';
import { ManufacturingPageChrome } from '@/components/manufacturing/ManufacturingPageChrome';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  MANUFACTURING_LINE_PRICING_OPTIONS,
  parseManufacturingLinePricingPolicy,
  type ManufacturingLinePricingPolicy,
} from '@/lib/manufacturing/line-pricing';
import {
  MANUFACTURING_SETTINGS_ACCOUNT_FIELDS,
  type ManufacturingSettingsView,
} from '@/lib/manufacturing/settings-types';
import { settingsPageHref } from '@/lib/transaction-settings/types';

type AccountIdState = Record<
  (typeof MANUFACTURING_SETTINGS_ACCOUNT_FIELDS)[number]['idKey'],
  string
>;

function emptyAccountIds(): AccountIdState {
  return {
    wipMaterialsAccountId: '',
    wipLaborOverheadAccountId: '',
    rawInventoryAccountId: '',
    finishedGoodsAccountId: '',
    overheadAbsorptionAccountId: '',
  };
}

function idsFromSettings(row?: ManufacturingSettingsView | null): AccountIdState {
  const next = emptyAccountIds();
  if (!row) return next;
  for (const field of MANUFACTURING_SETTINGS_ACCOUNT_FIELDS) {
    next[field.idKey] = row[field.refKey]?.id ?? '';
  }
  return next;
}

export default function ManufacturingSettingsPage() {
  useBackendReachability();
  const invalidate = useInvalidateQuery();
  const { data, isLoading } = useApiQuery<ManufacturingSettingsView>(
    ['manufacturing-settings'],
    '/manufacturing/settings'
  );
  const saved = data?.data ?? null;
  const [linePricingPolicy, setLinePricingPolicy] =
    useState<ManufacturingLinePricingPolicy>('AVERAGE_COST');
  const [allowWorkWithoutBom, setAllowWorkWithoutBom] = useState(true);
  const [accountIds, setAccountIds] = useState<AccountIdState>(emptyAccountIds);

  useEffect(() => {
    if (!saved) return;
    setLinePricingPolicy(parseManufacturingLinePricingPolicy(saved.linePricingPolicy));
    setAllowWorkWithoutBom(Boolean(saved.allowWorkWithoutBom));
    setAccountIds(idsFromSettings(saved));
  }, [saved]);

  const save = useApiMutation<ManufacturingSettingsView, Record<string, unknown>>(
    '/manufacturing/settings',
    'PUT',
    {
      successMessage: 'تم حفظ إعدادات التصنيع',
      onSuccess: () => {
        invalidate(['manufacturing-settings']);
      },
    }
  );

  return (
    <ManufacturingPageChrome
      title="إعدادات التصنيع"
      statusLabel="سياسات"
      statusTone="neutral"
      favoriteHref="/manufacturing/settings"
      hideSave
      breadcrumbs={[
        { href: '/manufacturing', label: 'التصنيع والإنتاج' },
        { label: 'الإعدادات' },
      ]}
    >
      <div className="mx-auto max-w-4xl space-y-4" dir="rtl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#0E78AA]" />
              <h2 className="text-lg font-bold text-[#0A3D5E]">سياسات موديول التصنيع</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              تسعير خانات الأصناف، وحسابات قيد التصنيع. إعدادات الترقيم والترحيل لكل مستند من شاشة المستند
              أو من الروابط تحت.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={save.isPending || isLoading}
            onClick={() =>
              save.mutate({
                linePricingPolicy,
                allowWorkWithoutBom,
                wipMaterialsAccountCode: accountIds.wipMaterialsAccountId || null,
                wipLaborOverheadAccountCode: accountIds.wipLaborOverheadAccountId || null,
                rawInventoryAccountCode: accountIds.rawInventoryAccountId || null,
                finishedGoodsAccountCode: accountIds.finishedGoodsAccountId || null,
                overheadAbsorptionAccountCode: accountIds.overheadAbsorptionAccountId || null,
              })
            }
          >
            حفظ الإعدادات
          </Button>
        </header>

        <section className="rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#0A3D5E]">تسعير الخامات</h3>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            يدوي: تكتب سعر الخامة بنفسك. تلقائي: السعر يُعبّى من متوسط التكلفة أو آخر شراء عند اختيار الصنف.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MANUFACTURING_LINE_PRICING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLinePricingPolicy(opt.value)}
                className={`rounded-xl border px-3 py-3 text-right ${
                  linePricingPolicy === opt.value
                    ? 'border-[#0E78AA] bg-[#0E78AA]/10 text-[#0E78AA]'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">{opt.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#0A3D5E]">العمل بدون نماذج التصنيع</h3>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            عملية التصنيع تقدر تتحفظ مباشرة بدون نموذج. الإلزام هنا اختياري فقط لو حابب تفضّل التحميل من نموذج.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: false, label: 'إلزامي اختيار نموذج', hint: 'زي الوضع الحالي: تحميل من نموذج التصنيع.' },
                {
                  value: true,
                  label: 'السماح بالعمل بدون نموذج',
                  hint: 'تقدر تدخل الخامات والمنتج يدوياً من غير اختيار نموذج.',
                },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setAllowWorkWithoutBom(opt.value)}
                className={`rounded-xl border px-3 py-3 text-right ${
                  allowWorkWithoutBom === opt.value
                    ? 'border-[#0E78AA] bg-[#0E78AA]/10 text-[#0E78AA]'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">{opt.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#0A3D5E]">حسابات قيد التصنيع</h3>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            الحسابات المستخدمة عند ترحيل أمر التصنيع. لو الخانة فاضية يُستخدم الحساب الافتراضي من دليل
            الحسابات.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MANUFACTURING_SETTINGS_ACCOUNT_FIELDS.map((field) => (
              <div key={field.idKey}>
                <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">{field.label}</label>
                <AccountSelect
                  value={accountIds[field.idKey]}
                  onChange={(id) => setAccountIds((prev) => ({ ...prev, [field.idKey]: id }))}
                  leafOnly
                  selectedAccount={saved?.[field.refKey] ?? null}
                  placeholder="اختر من شجرة حسابات هذه الشركة"
                />
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{field.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#0A3D5E]">إعدادات المستندات</h3>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            ترقيم، ترحيل تلقائي، ومخزن افتراضي لكل شاشة.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['MANUFACTURING_ORDER', 'إعدادات أمر التصنيع'],
                ['MANUFACTURING_WORK_ORDER', 'إعدادات أمر الشغل'],
              ] as const
            ).map(([type, label]) => (
              <Link
                key={type}
                href={settingsPageHref(type)}
                className="flex items-center justify-between rounded-xl border border-[#E6F0F7] bg-white px-3 py-3 text-sm font-semibold text-[#0A3D5E] hover:border-[#0E78AA]/40"
              >
                {label}
                <ChevronLeft className="h-4 w-4 text-[#0E78AA]" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ManufacturingPageChrome>
  );
}
