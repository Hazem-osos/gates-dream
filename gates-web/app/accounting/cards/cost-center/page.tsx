'use client';
import * as React from "react";
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import UserPermissionsBar from "@/components/UserPermissionsBar";
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
  Switch,
} from "@/components/ui";
import { useApiQuery, useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from '@/lib/api/types';
import { costCenterCardFormSchema } from '@/lib/validation/accounting.schema';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';

const EMPTY_COST_CENTER_FORM = {
  code: '',
  arabicName: '',
  englishName: '',
  parentId: '',
  quantityBudget: '',
  warning: '' as 'مدين' | 'دائن' | 'بدون' | '',
  budget: '',
  currencyCode: '',
  isActive: true,
};

interface CostCenter {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

function CostCenterPage() {
  const invalidateQuery = useInvalidateQuery();
  const { data: settingsRes } = useAccountingSettingsQuery();
  const costCenterAuto = settingsRes?.data?.general?.costCenterAutoNumbering !== false;
  const costCenterCount = settingsRes?.data?.general?.numberingRecordCounts?.costCenters ?? 0;
  
  const [formData, setFormData] = useState({ ...EMPTY_COST_CENTER_FORM });
  const [codeTouched, setCodeTouched] = useState(false);

  const [showParentSearch, setShowParentSearch] = useState(false);
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch parent cost centers
  const { data: costCentersResponse } = useApiQuery<CostCenter[]>(
    ['cost-centers'],
    '/accounting/cost-centers',
    { limit: 1000, isActive: true }
  );
  const costCenters = costCentersResponse?.data || [];

  const { data: nextCodeResponse } = useApiQuery<{ code?: string }>(
    ['cost-centers', 'next-code', formData.parentId || 'root'],
    '/accounting/cost-centers/next-code',
    formData.parentId ? { parentId: formData.parentId } : undefined,
    { enabled: costCenterAuto }
  );

  useEffect(() => {
    const suggested = nextCodeResponse?.data?.code;
    if (!suggested || codeTouched || !costCenterAuto) return;
    setFormData((prev) => (prev.code === suggested ? prev : { ...prev, code: suggested }));
  }, [codeTouched, costCenterAuto, nextCodeResponse?.data?.code]);

  // Fetch currencies
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data || [];

  // Cost center mutation
  const costCenterMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/cost-centers',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ مركز التكلفة بنجاح');
        invalidateQuery(['cost-centers']);
        // Reset form
        setFormData({ ...EMPTY_COST_CENTER_FORM });
        setCodeTouched(false);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = costCenterMutation.isPending;

  // Filter parent cost centers
  const filteredParents = costCenters.filter((cc: CostCenter) =>
    cc.code.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
    cc.arabicName.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
    (cc.englishName && cc.englishName.toLowerCase().includes(parentSearchTerm.toLowerCase()))
  );

  const handleParentSelect = (costCenter: CostCenter) => {
    setFormData({ ...formData, parentId: costCenter.id });
    setShowParentSearch(false);
    setParentSearchTerm('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const parsed = costCenterCardFormSchema.safeParse(formData);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'يرجى مراجعة بيانات مركز التكلفة');
      return;
    }
    if (!costCenterAuto && !formData.code.trim()) {
      setError('رقم المركز مطلوب — الترقيم يدوي');
      return;
    }

    const requestBody = {
      code: formData.code.trim() || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      parentId: formData.parentId || undefined,
      quantityBudget: formData.quantityBudget ? parseFloat(formData.quantityBudget) : undefined,
      warning: formData.warning || undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      currencyCode: formData.currencyCode || undefined,
      isActive: formData.isActive,
    };

    costCenterMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setError('');
    setSuccess('');
    setFormData({ ...EMPTY_COST_CENTER_FORM });
    setCodeTouched(false);
  };

  const selectedParent = costCenters.find((cc: CostCenter) => cc.id === formData.parentId);

  const advancedFilledCount = [
    formData.englishName,
    formData.quantityBudget,
    formData.warning,
    formData.budget,
    formData.currencyCode,
    formData.isActive ? '' : '1',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageHeader
        title="بطاقة مركز تكلفة"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'البطاقات' },
          { label: 'مركز تكلفة' },
        ]}
        actions={
          <NumberingModeControl
            kind="costCenters"
            auto={costCenterAuto}
            recordCount={costCenterCount}
            settingKey="costCenterAutoNumbering"
          />
        }
      />

      <div className="mb-4">
        <UserPermissionsBar resource="cost-center" module="accounting" />
      </div>
      <form className="w-full text-base">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف مركز التكلفة" icon={Layers}>
          <CompactFormField
            label="رقم مركز التكلفة"
            value={formData.code}
            disabled={costCenterAuto}
            onChange={(e) => {
              setCodeTouched(true);
              setFormData({ ...formData, code: e.target.value });
            }}
            placeholder={costCenterAuto ? 'تلقائي' : 'أدخل الرقم'}
          />
          <CompactFormField
            label="إسم المركز"
            value={formData.arabicName}
            onChange={(e) => setFormData({ ...formData, arabicName: e.target.value })}
            placeholder="إدخل الإسم بالعربي"
          />
          <CompactFormField label="م/ رئيسي">
            <div className="relative">
              <input
                type="text"
                placeholder={selectedParent ? `${selectedParent.code} - ${selectedParent.arabicName}` : "ابحث عن مركز رئيسي"}
                className={`${compactControlClass} pl-10`}
                value={parentSearchTerm}
                onChange={(e) => {
                  setParentSearchTerm(e.target.value);
                  setShowParentSearch(true);
                }}
                onFocus={() => setShowParentSearch(true)}
              />
              <button
                type="button"
                className="absolute left-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#D6EAF3] bg-blue-200"
                onClick={() => setShowParentSearch(!showParentSearch)}
              >
                <img src="/magnifying-glass-1.svg" alt="بحث" className="h-4 w-4" />
              </button>
              {showParentSearch && (
                <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[#D6EAF3] bg-white shadow-lg">
                  {filteredParents.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">لا توجد نتائج</div>
                  ) : (
                    filteredParents.map((cc: CostCenter) => (
                      <div
                        key={cc.id}
                        className="cursor-pointer border-b border-[#D6EAF3] p-3 last:border-b-0 hover:bg-[#F6FBFD]"
                        onClick={() => handleParentSelect(cc)}
                      >
                        <div className="font-semibold text-[#094C6B]">{cc.code} - {cc.arabicName}</div>
                        {cc.englishName && <div className="text-sm text-gray-600">{cc.englishName}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </CompactFormField>
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField label="حالة المركز" className="sm:col-span-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                label="مركز تكلفة نشط"
              />
            </CompactFormField>
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
              placeholder="إدخل الإسم بالإنجليزي"
            />
            <CompactFormField
              label="موازنة كميات"
              type="number"
              value={formData.quantityBudget}
              onChange={(e) => setFormData({ ...formData, quantityBudget: e.target.value })}
              placeholder="0"
            />
            <CompactFormField
              label="موازنة تقديرية"
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              placeholder="إدخل الموازنة التقديرية"
            />
            <CompactFormField label="رمز العملة">
              <select
                className={compactControlClass}
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
              >
                <option value="">اختر العملة</option>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.arabicName} ({currency.code})
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="تحذير" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'مدين' as const, label: 'مدين' },
                  { value: 'دائن' as const, label: 'دائن' },
                  { value: 'بدون' as const, label: 'بدون' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.warning === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="warning"
                      className="sr-only"
                      checked={formData.warning === opt.value}
                      onChange={() => setFormData({ ...formData, warning: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={handleSave}
          saveLoading={loading}
          status="مسودة"
        />
      </form>
    </div>
  );
}

export default CostCenterPage;
