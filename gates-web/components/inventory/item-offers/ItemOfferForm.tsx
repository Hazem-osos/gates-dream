'use client';

import { useMemo, useState } from 'react';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { DocumentHeaderBar } from '@/components/common/document-shell/DocumentHeaderBar';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCustomersQuery, useSuppliersQuery } from '@/lib/hooks/useMasterDataQueries';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import { DOCUMENT_BASE_TYPE_LABELS, type DocumentBaseType } from '@/lib/document-profiles/types';
import { toHijriDate } from '@/lib/hijri-date';
import {
  inventoryItemOfferFormSchema,
  type InventoryItemOfferFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { PromotionScopeCard, type PromotionTargetType } from './PromotionScopeCard';
import { PromotionStickyFooter } from './PromotionStickyFooter';
import type { MultiSelectOption } from './SearchableMultiSelect';

type NewModuleRow = {
  id: string;
  nameAr?: string;
  menuNameAr?: string;
  fullCode?: string;
  baseType?: string;
  isActive?: boolean;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function emptyForm(): InventoryItemOfferFormInput {
  return {
    nameAr: '',
    description: '',
    targetType: 'SALES',
    promotionType: 'BUY_X_GET_Y',
    sourceItemId: '',
    sourceQuantity: '',
    giftItemId: '',
    giftQuantity: '',
    invoiceThresholdAmount: '',
    discountPercentage: '',
    startDate: todayIso(),
    endDate: plusDaysIso(30),
    applyToAllParties: true,
    targetPartyIds: [],
    applyToAllPatterns: true,
    targetPatternIds: [],
    isActive: true,
  };
}

const fieldClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';

const SALES_MODULE_TYPES = new Set(['SI', 'SR']);
const PURCHASE_MODULE_TYPES = new Set(['PI', 'PR']);
const SALES_PROFILE_TYPES = new Set<DocumentBaseType>(['SALES_INVOICE', 'SALES_RETURN']);
const PURCHASE_PROFILE_TYPES = new Set<DocumentBaseType>(['PURCHASE_INVOICE', 'PURCHASE_RETURN']);

export function ItemOfferForm() {
  const invalidateQuery = useInvalidateQuery();
  const [form, setForm] = useState<InventoryItemOfferFormInput>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);

  const patch = <K extends keyof InventoryItemOfferFormInput>(key: K, value: InventoryItemOfferFormInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const { data: customersResponse } = useCustomersQuery(1000);
  const { data: suppliersResponse } = useSuppliersQuery(1000);
  const { data: profilesResponse } = useDocumentProfiles();
  const { data: modulesResponse } = useApiQuery<NewModuleRow[]>(['new-modules', 'item-offers'], '/new-modules');

  const customersList: MultiSelectOption[] = useMemo(
    () =>
      (customersResponse?.data ?? []).map((row) => ({
        value: row.id,
        label: row.code ? `[${row.code}] ${row.arabicName}` : row.arabicName,
      })),
    [customersResponse?.data]
  );
  const suppliersList: MultiSelectOption[] = useMemo(
    () =>
      (suppliersResponse?.data ?? []).map((row) => ({
        value: row.id,
        label: row.code ? `[${row.code}] ${row.arabicName}` : row.arabicName,
      })),
    [suppliersResponse?.data]
  );

  const entryPatternsList: MultiSelectOption[] = useMemo(() => {
    const isSales = form.targetType === 'SALES';
    const moduleTypes = isSales ? SALES_MODULE_TYPES : PURCHASE_MODULE_TYPES;
    const profileTypes = isSales ? SALES_PROFILE_TYPES : PURCHASE_PROFILE_TYPES;
    const modules = (modulesResponse?.data ?? [])
      .filter((row) => row.isActive !== false && row.baseType && moduleTypes.has(row.baseType))
      .map((row) => ({
        value: row.id,
        label: `${row.fullCode || row.baseType || ''} — ${row.menuNameAr || row.nameAr || 'نمط'}`,
      }));
    const profiles = (profilesResponse?.data ?? [])
      .filter((row) => row.isActive && profileTypes.has(row.baseType))
      .map((row) => ({
        value: row.id,
        label: `${DOCUMENT_BASE_TYPE_LABELS[row.baseType] || row.baseType} — ${row.nameAr}`,
      }));
    return [...modules, ...profiles];
  }, [form.targetType, modulesResponse?.data, profilesResponse?.data]);

  const mutation = useApiMutation<unknown, Record<string, unknown>>('/inventory/item-offers', 'POST', {
    showSuccessToast: false,
    onSuccess: () => {
      setSuccess('تم حفظ العرض الترويجي بنجاح');
      invalidateQuery(['item-offers']);
      setForm(emptyForm());
      setFieldErrors({});
    },
    onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء حفظ العرض'),
  });

  const handleSave = () => {
    setError('');
    const parsed = inventoryItemOfferFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setError(parsed.error.issues[0]?.message || 'يرجى استكمال بيانات العرض');
      return;
    }
    setFieldErrors({});
    const values = parsed.data;
    mutation.mutate({
      nameAr: values.nameAr,
      description: values.description || undefined,
      targetType: values.targetType,
      promotionType: values.promotionType,
      sourceItemId: values.sourceItemId || undefined,
      sourceQuantity: values.sourceQuantity ? Number(values.sourceQuantity) : undefined,
      giftItemId: values.giftItemId || undefined,
      giftQuantity: values.giftQuantity ? Number(values.giftQuantity) : undefined,
      invoiceThresholdAmount: values.invoiceThresholdAmount
        ? Number(values.invoiceThresholdAmount)
        : undefined,
      discountPercentage: values.discountPercentage ? Number(values.discountPercentage) : undefined,
      startDate: values.startDate,
      endDate: values.endDate,
      hijriStartDate: toHijriDate(values.startDate),
      hijriEndDate: toHijriDate(values.endDate),
      applyToAllParties: values.applyToAllParties,
      targetPartyIds: values.applyToAllParties ? [] : values.targetPartyIds,
      applyToAllPatterns: values.applyToAllPatterns,
      targetPatternIds: values.applyToAllPatterns ? [] : values.targetPatternIds,
      isActive: values.isActive,
    });
  };

  const resetForm = () => {
    setForm(emptyForm());
    setFieldErrors({});
    setError('');
    setSuccess('');
  };

  const setTargetType = (value: PromotionTargetType) => {
    setForm((prev) => ({
      ...prev,
      targetType: value,
      targetPartyIds: [],
      targetPatternIds: prev.applyToAllPatterns ? [] : prev.targetPatternIds,
    }));
  };

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        <DocumentHeaderBar
          breadcrumbs={[
            { href: '/inventory', label: 'المخازن' },
            { label: 'العمليات' },
            { label: 'عروض الأصناف' },
          ]}
          title="عروض الأصناف"
          docNumber={form.nameAr || 'OFFER-XXXX'}
          statusTone={form.isActive ? 'success' : 'warning'}
          statusLabel={form.isActive ? 'نشط' : 'مسودة'}
          onSaveDraft={handleSave}
          saveLabel="حفظ العرض"
          savePending={mutation.isPending}
          canSave
          onBrowseList={() => setBrowseOpen(true)}
          browseListLabel="السابق"
          favoriteHref="/inventory/operations/item-offers"
          favoriteLabel="عروض الأصناف"
        />

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <div className="mb-4 space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-foreground">اسم العرض / الترويج</label>
              <input
                type="text"
                value={form.nameAr}
                onChange={(e) => patch('nameAr', e.target.value)}
                className={fieldClass}
                placeholder="مثال: عرض الصيف - اشترِ 10 واحصل على 2 هدية"
              />
              {fieldErrors.nameAr ? <p className="text-xs text-destructive">{fieldErrors.nameAr}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">نوع العرض</label>
              <select
                className={fieldClass}
                value={form.targetType}
                onChange={(e) => setTargetType(e.target.value as PromotionTargetType)}
              >
                <option value="SALES">عرض مبيعات (عملاء)</option>
                <option value="PURCHASES">عرض مشتريات (موردين)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">الشرح / البيان</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => patch('description', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="شروط وتفاصيل تطبيق العرض الترويجي..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-3 md:grid-cols-2">
            <DatePickerWithHijri
              label="من تاريخ (بداية سريان العرض)"
              value={form.startDate}
              onChange={(d) => patch('startDate', d)}
              error={Boolean(fieldErrors.startDate)}
            />
            <DatePickerWithHijri
              label="إلى تاريخ (نهاية سريان العرض)"
              value={form.endDate}
              onChange={(d) => patch('endDate', d)}
              error={Boolean(fieldErrors.endDate)}
            />
          </div>
        </div>

        <div className="mb-4 space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <h3 className="text-xs font-bold text-foreground">قاعدة العرض</h3>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => patch('isActive', e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input"
              />
              العرض فعال
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">كيفية العرض</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['BUY_X_GET_Y', 'كمية إضافية (اشترِ واحصل)'],
                  ['DISCOUNT_PERCENTAGE', 'خصم نسبة'],
                  ['INVOICE_TOTAL_THRESHOLD', 'قيمة الفاتورة'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch('promotionType', value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    form.promotionType === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.promotionType !== 'INVOICE_TOTAL_THRESHOLD' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">الصنف الأساسي والكمية المطلوبة</label>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <ItemSelect
                      value={form.sourceItemId || ''}
                      onChange={(id) => patch('sourceItemId', id)}
                      emptyLabel="اختر الصنف الأساسي..."
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={form.sourceQuantity || ''}
                    onChange={(e) => patch('sourceQuantity', e.target.value)}
                    className="h-9 w-24 rounded-md border border-input px-2 text-center font-mono text-xs"
                    placeholder="الكمية"
                  />
                </div>
                {fieldErrors.sourceItemId ? (
                  <p className="text-xs text-destructive">{fieldErrors.sourceItemId}</p>
                ) : null}
              </div>

              {form.promotionType === 'BUY_X_GET_Y' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    الصنف الهدية والكمية المجانية
                  </label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <ItemSelect
                        value={form.giftItemId || ''}
                        onChange={(id) => patch('giftItemId', id)}
                        emptyLabel="اختر الصنف الهدية..."
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={form.giftQuantity || ''}
                      onChange={(e) => patch('giftQuantity', e.target.value)}
                      className="h-9 w-24 rounded-md border border-input px-2 text-center font-mono text-xs font-bold text-emerald-600"
                      placeholder="هدية"
                    />
                  </div>
                  {fieldErrors.giftItemId ? (
                    <p className="text-xs text-destructive">{fieldErrors.giftItemId}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">نسبة الخصم (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={form.discountPercentage || ''}
                      onChange={(e) => patch('discountPercentage', e.target.value)}
                      className="h-9 w-full rounded-md border border-input px-3 pr-7 text-end font-mono text-xs font-bold text-primary"
                      placeholder="مثال: 10"
                    />
                    <span className="absolute right-2 top-2.5 text-xs font-bold text-muted-foreground">%</span>
                  </div>
                  {fieldErrors.discountPercentage ? (
                    <p className="text-xs text-destructive">{fieldErrors.discountPercentage}</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">الحد الأدنى لقيمة الفاتورة (ج.م)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.invoiceThresholdAmount || ''}
                  onChange={(e) => patch('invoiceThresholdAmount', e.target.value)}
                  className="h-9 w-full rounded-md border border-input px-3 text-end font-mono text-xs"
                  placeholder="مثال: 5000"
                />
                {fieldErrors.invoiceThresholdAmount ? (
                  <p className="text-xs text-destructive">{fieldErrors.invoiceThresholdAmount}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">نسبة الخصم (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={form.discountPercentage || ''}
                    onChange={(e) => patch('discountPercentage', e.target.value)}
                    className="h-9 w-full rounded-md border border-input px-3 pr-7 text-end font-mono text-xs font-bold text-primary"
                    placeholder="مثال: 10"
                  />
                  <span className="absolute right-2 top-2.5 text-xs font-bold text-muted-foreground">%</span>
                </div>
                {fieldErrors.discountPercentage ? (
                  <p className="text-xs text-destructive">{fieldErrors.discountPercentage}</p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <PromotionScopeCard
          targetType={form.targetType}
          applyToAllParties={form.applyToAllParties}
          setApplyToAllParties={(value) => patch('applyToAllParties', value)}
          targetPartyIds={form.targetPartyIds}
          setTargetPartyIds={(ids) => patch('targetPartyIds', ids)}
          applyToAllPatterns={form.applyToAllPatterns}
          setApplyToAllPatterns={(value) => patch('applyToAllPatterns', value)}
          targetPatternIds={form.targetPatternIds}
          setTargetPatternIds={(ids) => patch('targetPatternIds', ids)}
          customersList={customersList}
          suppliersList={suppliersList}
          entryPatternsList={entryPatternsList}
          partyError={fieldErrors.targetPartyIds}
          patternError={fieldErrors.targetPatternIds}
        />

        <PromotionStickyFooter
          targetType={form.targetType}
          applyToAllParties={form.applyToAllParties}
          targetPartyIds={form.targetPartyIds}
          applyToAllPatterns={form.applyToAllPatterns}
          targetPatternIds={form.targetPatternIds}
          isSubmitting={mutation.isPending}
          onSave={handleSave}
          onCancel={resetForm}
        />

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="العروض السابقة">
          <GenericRecordsList
            apiPath="/inventory/item-offers"
            listKey="item-offers-browse"
            paging="skip"
            allowDeleteDraft={false}
            searchPlaceholder="بحث باسم العرض…"
            columns={[
              {
                id: 'name',
                header: 'العرض',
                getValue: (row) => String(row.nameAr ?? row.description ?? row.serial ?? row.id.slice(0, 8)),
              },
              {
                id: 'type',
                header: 'النوع',
                getValue: (row) => (row.type === 'sales' ? 'مبيعات' : 'مشتريات'),
              },
              {
                id: 'dates',
                header: 'الفترة',
                getValue: (row) =>
                  `${row.fromDate ? new Date(String(row.fromDate)).toLocaleDateString('ar-EG') : '—'} → ${
                    row.toDate ? new Date(String(row.toDate)).toLocaleDateString('ar-EG') : '—'
                  }`,
              },
            ]}
            resolveStatus={(row) =>
              row.isActive === false
                ? { variant: 'warning', label: 'متوقف' }
                : { variant: 'success', label: 'نشط' }
            }
            onSelect={() => setBrowseOpen(false)}
          />
        </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}
