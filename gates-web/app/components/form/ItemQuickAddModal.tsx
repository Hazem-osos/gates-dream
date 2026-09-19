'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionButtons,
  AdvancedFieldsSection,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { toast } from '@/lib/feedback/toast';
import type { QuickCreatedItem } from '@/app/components/form/QuickCreateItemModal';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

type ItemQuickAddModalProps = {
  open: boolean;
  initialName: string;
  initialCode?: string;
  onClose: () => void;
  onCreated: (item: QuickCreatedItem) => void;
};

type UnitRow = { id: string; arabicName: string; code?: string | null };
type CategoryRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  defaultInventoryAccountId?: string | null;
  defaultSalesAccountId?: string | null;
  defaultCogsAccountId?: string | null;
};

type FormState = {
  serial: string;
  barcode: string;
  arabicName: string;
  englishName: string;
  categoryId: string;
  mainAccountId: string;
  salesAccountId: string;
  cogsAccountId: string;
  unitId: string;
  secondaryEnabled: boolean;
  secondaryUnitId: string;
  secondaryConversionFactor: string;
  secondaryFactorFixed: boolean;
  defaultTaxPercent: string;
  taxExemptionReason: string;
};

function emptyForm(initialName: string, initialCode?: string): FormState {
  return {
    serial: initialCode ?? '',
    barcode: '',
    arabicName: initialName,
    englishName: '',
    categoryId: '',
    mainAccountId: '',
    salesAccountId: '',
    cogsAccountId: '',
    unitId: '',
    secondaryEnabled: false,
    secondaryUnitId: '',
    secondaryConversionFactor: '',
    secondaryFactorFixed: true,
    defaultTaxPercent: '',
    taxExemptionReason: '',
  };
}

/**
 * Enterprise-depth item quick-add for the sales-invoice line grid (Sales
 * Invoice Enterprise Redesign, Phase 7): category-driven GL auto-assign
 * (with a manual override escape hatch), multi-unit mapping, and a per-item
 * tax profile — a richer replacement for the simpler `QuickCreateItemModal`
 * used elsewhere in the app, which keeps its lighter flow unchanged.
 */
export function ItemQuickAddModal({
  open,
  initialName,
  initialCode,
  onClose,
  onCreated,
}: ItemQuickAddModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyForm(initialName, initialCode));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: settingsRes } = useAccountingSettingsQuery();
  const itemAuto = settingsRes?.data?.general?.itemAutoNumbering !== false;

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initialName, initialCode));
      setError('');
    }
  }, [open, initialName, initialCode]);

  const { data: categoriesResponse } = useApiQuery<CategoryRow[]>(
    ['item-categories', { limit: 200 }],
    '/inventory/item-categories',
    { limit: 200, isActive: true },
    { enabled: open }
  );
  const categories = categoriesResponse?.data ?? [];

  const { data: unitsResponse } = useApiQuery<UnitRow[]>(
    ['units', { limit: 100 }],
    '/inventory/units',
    { limit: 100, isActive: true },
    { enabled: open }
  );
  const units = unitsResponse?.data ?? [];

  const { data: itemsSerialRes } = useApiQuery<{ serial?: string | null }[]>(
    ['items', 'serials'],
    '/inventory/items',
    { limit: 500, isActive: true },
    { enabled: open && itemAuto && !initialCode }
  );
  const nextItemSerial = nextNumericSerial((itemsSerialRes?.data ?? []).map((row) => row.serial));

  useEffect(() => {
    if (!open || !itemAuto || initialCode) return;
    setForm((prev) => (prev.serial ? prev : { ...prev, serial: nextItemSerial }));
  }, [initialCode, itemAuto, nextItemSerial, open]);

  useEffect(() => {
    if (open && units.length > 0 && !form.unitId) {
      setForm((prev) => ({ ...prev, unitId: units[0].id }));
    }
  }, [open, units, form.unitId]);

  const itemMutation = useApiMutation<
    { id: string; arabicName: string; serial?: string },
    Record<string, unknown>
  >('/inventory/items', 'POST', { showSuccessToast: false });

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const accountOverrideCount = [form.mainAccountId, form.salesAccountId, form.cogsAccountId].filter(Boolean).length;

  const fail = (msg: string) => {
    setError(msg);
    toast.error(msg);
  };

  const submit = async () => {
    setError('');
    if (!form.arabicName.trim()) {
      fail('اسم الصنف مطلوب');
      return;
    }
    if (form.secondaryEnabled) {
      if (!form.secondaryUnitId) {
        fail('اختر الوحدة الثانوية أو ألغِ تفعيلها');
        return;
      }
      if (form.secondaryUnitId === form.unitId) {
        fail('يجب أن تختلف الوحدة الثانوية عن الوحدة الأساسية');
        return;
      }
      const factor = Number(form.secondaryConversionFactor);
      if (!Number.isFinite(factor) || factor <= 0) {
        fail('معامل تحويل الوحدة الثانوية يجب أن يكون رقماً أكبر من صفر');
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        arabicName: form.arabicName.trim(),
        serial: form.serial.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        englishName: form.englishName.trim() || undefined,
        categoryId: form.categoryId || undefined,
        mainAccountId: form.mainAccountId || undefined,
        salesAccountId: form.salesAccountId || undefined,
        cogsAccountId: form.cogsAccountId || undefined,
        itemType: 'normal',
        isAssembly: false,
      };
      if (form.defaultTaxPercent.trim()) {
        const n = Number(form.defaultTaxPercent);
        if (Number.isFinite(n)) body.defaultTaxPercent = n;
      }
      if (form.taxExemptionReason.trim()) {
        body.taxExemptionReason = form.taxExemptionReason.trim();
      }

      const created = await itemMutation.mutateAsync(body);
      const itemId = created.data?.id;
      if (!itemId) throw new Error('لم يُرجَع معرّف الصنف');

      const unitLinks: { unitId: string; unit: { id: string; arabicName: string } }[] = [];
      if (form.unitId) {
        await apiClient.post('/inventory/item-units', {
          itemId,
          unitId: form.unitId,
          conversionFactor: 1,
          isFactorFixed: true,
          isBaseUnit: true,
        });
        const label = units.find((u) => u.id === form.unitId)?.arabicName ?? 'الوحدة';
        unitLinks.push({ unitId: form.unitId, unit: { id: form.unitId, arabicName: label } });
      }
      if (form.secondaryEnabled && form.secondaryUnitId) {
        const factor = Number(form.secondaryConversionFactor);
        await apiClient.post('/inventory/item-units', {
          itemId,
          unitId: form.secondaryUnitId,
          conversionFactor: factor,
          isFactorFixed: form.secondaryFactorFixed,
          isBaseUnit: false,
        });
        const label = units.find((u) => u.id === form.secondaryUnitId)?.arabicName ?? 'الوحدة الثانوية';
        unitLinks.push({ unitId: form.secondaryUnitId, unit: { id: form.secondaryUnitId, arabicName: label } });
      }

      invalidateMasterDataClient(queryClient);
      queryClient.setQueriesData<{ data?: ItemOption[] }>({ queryKey: ['items'] }, (old) => {
        if (!old?.data) return old;
        const row: ItemOption = {
          id: itemId,
          arabicName: form.arabicName.trim(),
          serial: form.serial.trim() || created.data?.serial,
          units: unitLinks.map((l) => ({
            unitId: l.unitId,
            isBaseUnit: l.unitId === form.unitId,
            isFactorFixed: l.unitId === form.unitId ? true : form.secondaryFactorFixed,
            conversionFactor: l.unitId === form.unitId ? 1 : Number(form.secondaryConversionFactor) || 1,
            unit: l.unit,
          })),
          defaultTaxPercent: form.defaultTaxPercent.trim() ? Number(form.defaultTaxPercent) : null,
          taxExemptionReason: form.taxExemptionReason.trim() || null,
        };
        return { ...old, data: [row, ...old.data.filter((i) => i.id !== itemId)] };
      });

      const quickItem: QuickCreatedItem = {
        id: itemId,
        arabicName: form.arabicName.trim(),
        serial: form.serial.trim() || created.data?.serial,
        unitId: form.unitId || undefined,
        defaultTaxPercent: form.defaultTaxPercent.trim() ? Number(form.defaultTaxPercent) : undefined,
        taxExemptionReason: form.taxExemptionReason.trim() || undefined,
      };
      onCreated(quickItem);
      onClose();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as ApiError).message)
          : 'تعذر إنشاء الصنف';
      fail(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-quickadd-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 id="item-quickadd-title" className="mb-4 text-lg font-bold text-[#0A3D5E]">
          إضافة صنف جديد
        </h2>

        <FormSectionCard title="البيانات الأساسية" bodyClassName="lg:grid-cols-2">
          <CompactFormField
            label="الاسم بالعربية"
            required
            value={form.arabicName}
            onChange={(e) => set('arabicName', e.target.value)}
            autoFocus
          />
          <CompactFormField
            label="الاسم بالإنجليزية"
            value={form.englishName}
            onChange={(e) => set('englishName', e.target.value)}
          />
          <CompactFormField
            label="الكود"
            value={form.serial}
            disabled={itemAuto}
            onChange={(e) => set('serial', e.target.value)}
            placeholder={itemAuto ? 'تلقائي' : 'أدخل الكود'}
          />
          <CompactFormField label="الباركود" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          <CompactFormField label="التصنيف" className="sm:col-span-2 lg:col-span-2">
            <select
              className={compactControlClass}
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
            >
              <option value="">— بدون تصنيف —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ''}
                  {c.arabicName}
                </option>
              ))}
            </select>
          </CompactFormField>
        </FormSectionCard>

        <FormSectionCard title="المحاسبة والتكلفة" bodyClassName="lg:grid-cols-2">
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:col-span-2 lg:col-span-2">
            {selectedCategory
              ? `سيتم تعيين حسابات المخزون/الإيراد/تكلفة المبيعات تلقائياً من تصنيف "${selectedCategory.arabicName}" عند عدم تحديدها يدوياً أدناه.`
              : 'اختر تصنيفاً لتعيين الحسابات المحاسبية تلقائياً، أو حددها يدوياً من "تخصيص متقدم" أدناه.'}{' '}
            طريقة التقييم المتوسط المرجّح هي إعداد عام على مستوى الشركة (غير قابل للتخصيص لكل صنف).
          </p>
          <div className="sm:col-span-2 lg:col-span-2">
            <AdvancedFieldsSection title="تخصيص متقدم للحسابات" badgeCount={accountOverrideCount} className="mb-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <CompactFormField label="حساب المخزون">
                  <AccountSelect
                    value={form.mainAccountId}
                    onChange={(id) => set('mainAccountId', id)}
                    className={compactControlClass}
                    emptyLabel="— من التصنيف —"
                  />
                </CompactFormField>
                <CompactFormField label="حساب الإيراد">
                  <AccountSelect
                    value={form.salesAccountId}
                    onChange={(id) => set('salesAccountId', id)}
                    className={compactControlClass}
                    emptyLabel="— من التصنيف —"
                  />
                </CompactFormField>
                <CompactFormField label="حساب تكلفة المبيعات">
                  <AccountSelect
                    value={form.cogsAccountId}
                    onChange={(id) => set('cogsAccountId', id)}
                    className={compactControlClass}
                    emptyLabel="— من التصنيف —"
                  />
                </CompactFormField>
              </div>
            </AdvancedFieldsSection>
          </div>
          <CompactFormField label="الوحدة الأساسية" required>
            <select className={compactControlClass} value={form.unitId} onChange={(e) => set('unitId', e.target.value)}>
              {units.length === 0 ? <option value="">جاري تحميل الوحدات…</option> : null}
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code ? `[${u.code}] ` : ''}
                  {u.arabicName}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField label="وحدة ثانوية">
            <label className="flex h-9 items-center gap-2 text-xs font-semibold text-[#094C6B]">
              <input
                type="checkbox"
                checked={form.secondaryEnabled}
                onChange={(e) => set('secondaryEnabled', e.target.checked)}
                className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
              />
              وحدة ثانوية (اختياري)
            </label>
            {form.secondaryEnabled ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  className={compactControlClass}
                  value={form.secondaryUnitId}
                  onChange={(e) => set('secondaryUnitId', e.target.value)}
                >
                  <option value="">اختر الوحدة</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.arabicName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  placeholder="معامل التحويل"
                  className={compactControlClass}
                  value={form.secondaryConversionFactor}
                  onChange={(e) => set('secondaryConversionFactor', e.target.value)}
                />
                <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={form.secondaryFactorFixed}
                    onChange={(e) => set('secondaryFactorFixed', e.target.checked)}
                    className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                  />
                  معامل التحويل ثابت (ألغِ التحديد للأوزان والأقمشة والرولات)
                </label>
              </div>
            ) : null}
          </CompactFormField>
        </FormSectionCard>

        <FormSectionCard title="الوضع الضريبي" bodyClassName="lg:grid-cols-2">
          <CompactFormField
            label="نسبة الضريبة الافتراضية %"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.defaultTaxPercent}
            onChange={(e) => set('defaultTaxPercent', e.target.value)}
          />
          <CompactFormField
            label="سبب الإعفاء الضريبي (إن وجد)"
            value={form.taxExemptionReason}
            onChange={(e) => set('taxExemptionReason', e.target.value)}
          />
        </FormSectionCard>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-4">
          <ActionButtons
            onCancel={onClose}
            onSave={() => void submit()}
            saveText={saving ? 'جاري الحفظ…' : 'حفظ'}
            cancelText="إلغاء"
            saveDisabled={saving}
          />
        </div>
      </div>
    </div>
  );
}
