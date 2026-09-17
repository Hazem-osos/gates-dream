'use client';
import * as React from "react";
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import UserPermissionsBar from "@/components/UserPermissionsBar";
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
  Switch,
  AppTable,
} from "@/components/ui";
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { useApiQuery, useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from '@/lib/api/types';
import { costCenterCardFormSchema } from '@/lib/validation/accounting.schema';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import { bumpTrailingCode, isCodeAfter } from '@/lib/masters/nextNumericSerial';
import { toast } from '@/lib/feedback/toast';

const EMPTY_COST_CENTER_FORM = {
  code: '',
  arabicName: '',
  englishName: '',
  parentId: '',
  costCenterKind: 'HEADER' as 'HEADER' | 'POSTING',
  quantityBudget: '',
  warning: 'بدون' as 'مدين' | 'دائن' | 'بدون',
  budget: '',
  creditLimit: '',
  currencyCode: '',
  isActive: true,
};

interface CostCenter {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
  parentId?: string | null;
  costCenterKind?: 'HEADER' | 'POSTING' | null;
  warning?: 'مدين' | 'دائن' | 'بدون' | null;
  budget?: number | string | null;
  creditLimit?: number | string | null;
  quantityBudget?: number | string | null;
  currencyCode?: string | null;
  isActive?: boolean;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

function CostCenterPage() {
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('cost-center');
  const { data: settingsRes } = useAccountingSettingsQuery();
  const costCenterAuto = settingsRes?.data?.general?.costCenterAutoNumbering !== false;
  const costCenterCount = settingsRes?.data?.general?.numberingRecordCounts?.costCenters ?? 0;
  
  const [formData, setFormData] = useState({ ...EMPTY_COST_CENTER_FORM });
  const [codeTouched, setCodeTouched] = useState(false);

  const [showParentSearch, setShowParentSearch] = useState(false);
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!quickCreate.prefillName) return;
    setFormData((prev) => (prev.arabicName ? prev : { ...prev, arabicName: quickCreate.prefillName }));
  }, [quickCreate.prefillName]);

  // Fetch parent cost centers
  const { data: costCentersResponse } = useApiQuery<CostCenter[]>(
    ['cost-centers', { limit: 1000, isActive: true }],
    '/accounting/cost-centers',
    { limit: 1000, isActive: true }
  );
  const costCenters = costCentersResponse?.data || [];
  const headerParents = costCenters.filter((cc) => cc.costCenterKind !== 'POSTING');

  const { data: nextCodeResponse } = useApiQuery<{ code?: string }>(
    ['cost-centers', 'next-code', formData.parentId || 'root'],
    '/accounting/cost-centers/next-code',
    formData.parentId ? { parentId: formData.parentId } : undefined,
    { enabled: costCenterAuto }
  );

  const keepParentIdRef = React.useRef(formData.parentId);
  keepParentIdRef.current = formData.parentId;
  const keepCodeRef = React.useRef(formData.code);
  keepCodeRef.current = formData.code;

  useEffect(() => {
    const suggested = nextCodeResponse?.data?.code;
    if (!suggested || codeTouched || !costCenterAuto) return;
    setFormData((prev) => {
      if (prev.code && isCodeAfter(prev.code, suggested)) return prev;
      return prev.code === suggested ? prev : { ...prev, code: suggested };
    });
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
      onSuccess: (res) => {
        const created = res?.data as { id?: string; arabicName?: string; code?: string } | undefined;
        if (created?.id) {
          quickCreate.complete({
            id: created.id,
            label: entityLabel(created.code, created.arabicName),
            arabicName: created.arabicName,
            code: created.code,
          });
        }
        setSuccess('تم حفظ مركز التكلفة بنجاح — تقدر تضيف التالي');
        invalidateQuery(['cost-centers']);
        setFormData({
          ...EMPTY_COST_CENTER_FORM,
          parentId: keepParentIdRef.current,
          costCenterKind: keepParentIdRef.current ? 'POSTING' : 'HEADER',
          code: bumpTrailingCode(created?.code || keepCodeRef.current),
        });
        setCodeTouched(false);
      },
      onError: (error: ApiError) => {
        const message = error.message || 'حدث خطأ أثناء الحفظ';
        setError(message);
        toast.error(message);
      },
    }
  );

  const loading = costCenterMutation.isPending;

  // Filter parent cost centers
  const filteredParents = headerParents.filter((cc: CostCenter) =>
    cc.code.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
    cc.arabicName.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
    (cc.englishName && cc.englishName.toLowerCase().includes(parentSearchTerm.toLowerCase()))
  );

  const handleParentSelect = (costCenter: CostCenter | null) => {
    setFormData((prev) => ({
      ...prev,
      parentId: costCenter?.id ?? '',
      costCenterKind: costCenter ? (prev.parentId ? prev.costCenterKind : 'POSTING') : 'HEADER',
    }));
    setShowParentSearch(false);
    setParentSearchTerm('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const parsed = costCenterCardFormSchema.safeParse(formData);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'يرجى مراجعة بيانات مركز التكلفة';
      setError(message);
      toast.error(message);
      return;
    }
    if (!costCenterAuto && !formData.code.trim()) {
      const message = 'رقم المركز مطلوب — الترقيم يدوي';
      setError(message);
      toast.error(message);
      return;
    }

    const requestBody = {
      code: formData.code.trim() || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      parentId: formData.parentId || undefined,
      costCenterKind: formData.costCenterKind,
      quantityBudget: formData.quantityBudget ? parseFloat(formData.quantityBudget) : undefined,
      warning: formData.warning || 'بدون',
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      currencyCode: formData.currencyCode || undefined,
      isActive: formData.isActive,
    };

    costCenterMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setError('');
    setSuccess('');
    setSelectedId(null);
    setFormData({ ...EMPTY_COST_CENTER_FORM });
    setCodeTouched(false);
  };

  const selectedParent = costCenters.find((cc: CostCenter) => cc.id === formData.parentId);

  const advancedFilledCount = [
    formData.englishName,
    formData.quantityBudget,
    formData.warning && formData.warning !== 'بدون' ? formData.warning : '',
    formData.budget,
    formData.creditLimit,
    formData.currencyCode,
    formData.isActive ? '' : '1',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <MasterCardShell
      title="بطاقة مركز تكلفة"
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: 'مركز تكلفة' },
      ]}
      docNumber={formData.code || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={loading}
      canSave={!loading}
      onNew={handleCancel}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      extraActions={
        <NumberingModeControl
          kind="costCenters"
          auto={costCenterAuto}
          recordCount={costCenterCount}
          settingKey="costCenterAutoNumbering"
        />
      }
      favoriteHref="/accounting/cards/cost-center"
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <div className="mb-4">
        <UserPermissionsBar resource="cost-center" module="accounting" />
      </div>
      <form className="w-full text-base">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف مركز التكلفة" icon={Layers}>
          <CompactFormField
            label="رقم مركز التكلفة"
            required={!costCenterAuto}
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
            required
            value={formData.arabicName}
            onChange={(e) => setFormData({ ...formData, arabicName: e.target.value })}
            placeholder="إدخل الإسم بالعربي"
          />
          <CompactFormField label="م/ رئيسي (اختياري)">
            <div className="relative">
              <input
                type="text"
                placeholder={selectedParent ? `${selectedParent.code} - ${selectedParent.arabicName}` : "ابحث عن مركز رئيسي أو رئيسي فرعي"}
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
                  <div
                    className="cursor-pointer border-b border-[#D6EAF3] p-3 hover:bg-[#F6FBFD]"
                    onClick={() => handleParentSelect(null)}
                  >
                    <div className="font-semibold text-[#094C6B]">مركز رئيسي (بدون أب)</div>
                  </div>
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
          {formData.parentId && !quickCreate.isQuickCreate ? (
            <CompactFormField label="نوع المركز الفرعي" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'POSTING' as const, label: 'مركز حركة' },
                  { value: 'HEADER' as const, label: 'رئيسي فرعي' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.costCenterKind === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="costCenterKind"
                      className="sr-only"
                      checked={formData.costCenterKind === opt.value}
                      onChange={() => setFormData((prev) => ({ ...prev, costCenterKind: opt.value }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
          ) : (
            <CompactFormField label="نوع المركز">
              <input
                className={compactControlClass}
                value={
                  quickCreate.isQuickCreate || formData.parentId
                    ? 'مركز حركة'
                    : 'رئيسي بدون أب'
                }
                readOnly
              />
            </CompactFormField>
          )}
          <CompactFormField
            label="الحد الائتماني"
            type="number"
            min="0"
            step="0.01"
            value={formData.creditLimit}
            onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
            placeholder="0"
          />
          <CompactFormField label="جهة التحذير">
            <select
              className={compactControlClass}
              value={formData.warning || 'بدون'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  warning: e.target.value as 'مدين' | 'دائن' | 'بدون',
                })
              }
            >
              <option value="بدون">بدون</option>
              <option value="مدين">مدين</option>
              <option value="دائن">دائن</option>
            </select>
          </CompactFormField>
          <CompactFormField
            label="موازنة تقديرية"
            type="number"
            min="0"
            step="0.01"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            placeholder="0"
          />
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
          </div>
        </AdvancedFieldsSection>

      </form>

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="مراكز التكلفة السابقة">
        <AppTable<CostCenter>
          data={costCenters}
          getRowKey={(r) => r.id}
          emptyTitle="لا توجد مراكز تكلفة بعد"
          onRowClick={(cc) => {
            setSelectedId(cc.id);
            setFormData((prev) => ({
              ...prev,
              code: cc.code,
              arabicName: cc.arabicName,
              englishName: cc.englishName || '',
              parentId: cc.parentId ?? '',
              costCenterKind: cc.costCenterKind === 'HEADER' ? 'HEADER' : cc.parentId ? 'POSTING' : 'HEADER',
              warning: cc.warning || 'بدون',
              budget: cc.budget != null ? String(cc.budget) : '',
              creditLimit: cc.creditLimit != null ? String(cc.creditLimit) : '',
              quantityBudget: cc.quantityBudget != null ? String(cc.quantityBudget) : '',
              currencyCode: cc.currencyCode || '',
              isActive: cc.isActive !== false,
            }));
            setShowGuide(false);
          }}
          columns={[
            { id: 'code', header: 'الكود', accessor: 'code' },
            { id: 'name', header: 'الاسم', accessor: 'arabicName' },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}

export default CostCenterPage;
