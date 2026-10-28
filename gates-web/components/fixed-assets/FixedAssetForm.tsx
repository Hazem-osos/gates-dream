'use client';

import { useState } from 'react';
import { Button, CompactFormField, FormSectionCard } from '@/app/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { PartySelect } from '@/app/components/form/PartySelect';
import { HrEmployeeSelect } from '@/app/components/hr/HrEmployeeSelect';
import { BranchSelect, CategorySelect, CostCenterSelect } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import {
  ACQUISITION_LABELS,
  METHOD_LABELS,
  formatDay,
  todayIso,
  toNumber,
  type AcquisitionType,
  type DepreciationMethod,
  type FixedAsset,
  type FixedAssetCategory,
} from '@/lib/fixed-assets/types';

type Form = {
  code: string;
  arabicName: string;
  englishName: string;
  categoryId: string;
  acquisitionType: AcquisitionType;
  acquisitionDate: string;
  inServiceDate: string;
  cost: string;
  vatAmount: string;
  salvageValue: string;
  usefulLifeYears: string;
  depreciationMethod: DepreciationMethod;
  decliningRate: string;
  openingAccumulatedDepreciation: string;
  openingDepreciatedThrough: string;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  creditMode: 'SUPPLIER' | 'ACCOUNT';
  supplierId: string;
  creditAccountId: string;
  branchId: string;
  costCenterId: string;
  custodianEmployeeId: string;
  location: string;
  serialNumber: string;
  barcode: string;
  invoiceReference: string;
  warrantyExpiry: string;
  notes: string;
};

function initial(asset?: FixedAsset): Form {
  const day = todayIso();
  return {
    code: asset?.code ?? '',
    arabicName: asset?.arabicName ?? '',
    englishName: asset?.englishName ?? '',
    categoryId: asset?.categoryId ?? '',
    acquisitionType: asset?.acquisitionType ?? 'PURCHASE',
    acquisitionDate: asset ? formatDay(asset.acquisitionDate) : day,
    inServiceDate: asset ? formatDay(asset.inServiceDate) : day,
    cost: asset ? String(toNumber(asset.cost)) : '',
    vatAmount: asset ? String(toNumber(asset.vatAmount)) : '0',
    salvageValue: asset ? String(toNumber(asset.salvageValue)) : '',
    usefulLifeYears: asset ? String(asset.usefulLifeMonths / 12) : '',
    depreciationMethod: asset?.depreciationMethod ?? 'STRAIGHT_LINE',
    decliningRate: asset?.decliningRate != null ? String(toNumber(asset.decliningRate)) : '',
    openingAccumulatedDepreciation: asset ? String(toNumber(asset.openingAccumulatedDepreciation)) : '0',
    openingDepreciatedThrough: asset?.openingDepreciatedThrough ? formatDay(asset.openingDepreciatedThrough) : '',
    assetAccountId: asset?.assetAccountId ?? '',
    accumulatedDepreciationAccountId: asset?.accumulatedDepreciationAccountId ?? '',
    depreciationExpenseAccountId: asset?.depreciationExpenseAccountId ?? '',
    creditMode: asset?.creditAccountId ? 'ACCOUNT' : 'SUPPLIER',
    supplierId: asset?.supplierId ?? '',
    creditAccountId: asset?.creditAccountId ?? '',
    branchId: asset?.branchId ?? '',
    costCenterId: asset?.costCenterId ?? '',
    custodianEmployeeId: asset?.custodianEmployeeId ?? '',
    location: asset?.location ?? '',
    serialNumber: asset?.serialNumber ?? '',
    barcode: asset?.barcode ?? '',
    invoiceReference: asset?.invoiceReference ?? '',
    warrantyExpiry: asset?.warrantyExpiry ? formatDay(asset.warrantyExpiry) : '',
    notes: asset?.notes ?? '',
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function FixedAssetForm({ asset, onSaved }: { asset?: FixedAsset; onSaved: (asset: FixedAsset) => void }) {
  const [form, setForm] = useState<Form>(() => initial(asset));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const isDraft = !asset || asset.status === 'DRAFT';
  const isDisposed = asset?.status === 'DISPOSED';
  const lockFinancial = !isDraft;
  const lockEstimates = isDisposed;
  const isPurchase = form.acquisitionType === 'PURCHASE';

  const applyCategory = (id: string, category?: FixedAssetCategory) => {
    setForm((f) => ({
      ...f,
      categoryId: id,
      ...(category
        ? {
            depreciationMethod: category.depreciationMethod,
            usefulLifeYears: category.usefulLifeMonths ? String(category.usefulLifeMonths / 12) : f.usefulLifeYears,
            decliningRate: category.decliningRate != null ? String(toNumber(category.decliningRate)) : f.decliningRate,
            assetAccountId: category.assetAccountId ?? '',
            accumulatedDepreciationAccountId: category.accumulatedDepreciationAccountId ?? '',
            depreciationExpenseAccountId: category.depreciationExpenseAccountId ?? '',
            salvageValue:
              f.cost && toNumber(category.salvagePercent) > 0
                ? String(Math.round(toNumber(f.cost) * toNumber(category.salvagePercent)) / 100)
                : f.salvageValue,
          }
        : {}),
    }));
  };

  const save = async () => {
    const years = Number(form.usefulLifeYears);
    const descriptive = {
      arabicName: form.arabicName.trim(),
      englishName: orNull(form.englishName),
      branchId: orNull(form.branchId),
      costCenterId: orNull(form.costCenterId),
      custodianEmployeeId: orNull(form.custodianEmployeeId),
      location: orNull(form.location),
      serialNumber: orNull(form.serialNumber),
      barcode: orNull(form.barcode),
      invoiceReference: orNull(form.invoiceReference),
      warrantyExpiry: orNull(form.warrantyExpiry),
      notes: orNull(form.notes),
    };
    const estimates = {
      usefulLifeMonths: years > 0 ? Math.round(years * 12) : undefined,
      salvageValue: form.salvageValue === '' ? undefined : toNumber(form.salvageValue),
      depreciationMethod: form.depreciationMethod,
      decliningRate: form.depreciationMethod === 'DECLINING_BALANCE' ? toNumber(form.decliningRate) || null : null,
    };
    const financial = {
      code: orNull(form.code),
      categoryId: form.categoryId,
      acquisitionType: form.acquisitionType,
      acquisitionDate: form.acquisitionDate,
      inServiceDate: form.inServiceDate,
      cost: toNumber(form.cost),
      vatAmount: isPurchase ? toNumber(form.vatAmount) : 0,
      openingAccumulatedDepreciation: toNumber(form.openingAccumulatedDepreciation),
      openingDepreciatedThrough: orNull(form.openingDepreciatedThrough),
      assetAccountId: orNull(form.assetAccountId),
      accumulatedDepreciationAccountId: orNull(form.accumulatedDepreciationAccountId),
      depreciationExpenseAccountId: orNull(form.depreciationExpenseAccountId),
      supplierId: isPurchase && form.creditMode === 'SUPPLIER' ? orNull(form.supplierId) : null,
      creditAccountId: isPurchase && form.creditMode === 'ACCOUNT' ? orNull(form.creditAccountId) : null,
    };
    setSaving(true);
    try {
      const res = asset
        ? await apiClient.put<FixedAsset>(`/fixed-assets/assets/${asset.id}`, {
            ...descriptive,
            ...(lockEstimates ? {} : estimates),
            ...(lockFinancial ? {} : financial),
            version: asset.version,
          })
        : await apiClient.post<FixedAsset>('/fixed-assets/assets', { ...descriptive, ...estimates, ...financial });
      if (res.data) onSaved(res.data);
    } catch {
      /* shown by the API client */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <FormSectionCard title="بيانات الأصل">
        <CompactFormField
          label="كود الأصل"
          hint={asset ? undefined : 'اتركه فارغًا للترقيم التلقائي'}
          value={form.code}
          disabled={lockFinancial}
          onChange={(e) => set('code', e.target.value)}
        />
        <CompactFormField label="اسم الأصل" required value={form.arabicName} onChange={(e) => set('arabicName', e.target.value)} />
        <CompactFormField label="الاسم الإنجليزي" value={form.englishName} onChange={(e) => set('englishName', e.target.value)} />
        <CompactFormField label="الفئة" required>
          <CategorySelect value={form.categoryId} disabled={lockFinancial} onChange={applyCategory} />
        </CompactFormField>
        <CompactFormField label="الرقم التسلسلي" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
        <CompactFormField label="الباركود" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
        <CompactFormField label="الموقع" value={form.location} onChange={(e) => set('location', e.target.value)} />
        <CompactFormField label="الفرع">
          <BranchSelect value={form.branchId} onChange={(id) => set('branchId', id)} />
        </CompactFormField>
        <CompactFormField label="مركز التكلفة" hint="يُحمّل عليه مصروف الإهلاك">
          <CostCenterSelect value={form.costCenterId} onChange={(id) => set('costCenterId', id)} />
        </CompactFormField>
        <CompactFormField label="الموظف صاحب العهدة">
          <HrEmployeeSelect value={form.custodianEmployeeId} onChange={(id) => set('custodianEmployeeId', id)} />
        </CompactFormField>
        <CompactFormField
          label="انتهاء الضمان"
          type="date"
          value={form.warrantyExpiry}
          onChange={(e) => set('warrantyExpiry', e.target.value)}
        />
        <CompactFormField label="ملاحظات" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </FormSectionCard>

      <FormSectionCard
        title="الاقتناء والتكلفة"
        subtitle={lockFinancial ? 'الأصل مُفعّل: لتعديل التكلفة أو التواريخ ألغِ التفعيل أولًا (لو لم يُرحل عليه إهلاك).' : undefined}
      >
        <CompactFormField label="نوع الاقتناء" required>
          <select
            className={compactControlClass}
            value={form.acquisitionType}
            disabled={lockFinancial}
            onChange={(e) => set('acquisitionType', e.target.value as AcquisitionType)}
          >
            {(Object.keys(ACQUISITION_LABELS) as AcquisitionType[]).map((t) => (
              <option key={t} value={t}>
                {ACQUISITION_LABELS[t]}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="تاريخ الشراء"
          required
          type="date"
          value={form.acquisitionDate}
          disabled={lockFinancial}
          onChange={(e) => set('acquisitionDate', e.target.value)}
        />
        <CompactFormField
          label="تاريخ التشغيل"
          required
          type="date"
          hint="يبدأ الإهلاك من نفس الشهر لو التشغيل يوم 15 أو قبله، وإلا من الشهر التالي"
          value={form.inServiceDate}
          disabled={lockFinancial}
          onChange={(e) => set('inServiceDate', e.target.value)}
        />
        <CompactFormField
          label="التكلفة (بدون ضريبة)"
          required
          type="number"
          inputMode="decimal"
          value={form.cost}
          disabled={lockFinancial}
          onChange={(e) => set('cost', e.target.value)}
        />
        {isPurchase ? (
          <>
            <CompactFormField
              label="ضريبة القيمة المضافة (مدخلات)"
              type="number"
              inputMode="decimal"
              hint="تُرحّل لحساب ضريبة المدخلات ولا تدخل في تكلفة الأصل"
              value={form.vatAmount}
              disabled={lockFinancial}
              onChange={(e) => set('vatAmount', e.target.value)}
            />
            <CompactFormField label="الطرف الدائن" required>
              <select
                className={compactControlClass}
                value={form.creditMode}
                disabled={lockFinancial}
                onChange={(e) => set('creditMode', e.target.value as Form['creditMode'])}
              >
                <option value="SUPPLIER">مورد</option>
                <option value="ACCOUNT">حساب (خزنة / بنك / أصول تحت التسوية)</option>
              </select>
            </CompactFormField>
            {form.creditMode === 'SUPPLIER' ? (
              <CompactFormField label="المورد" required>
                <PartySelect kind="SUPPLIER" value={form.supplierId} disabled={lockFinancial} onChange={(id) => set('supplierId', id)} />
              </CompactFormField>
            ) : (
              <CompactFormField label="الحساب الدائن" required>
                <AccountSelect value={form.creditAccountId} disabled={lockFinancial} onChange={(id) => set('creditAccountId', id)} />
              </CompactFormField>
            )}
          </>
        ) : null}
        <CompactFormField label="رقم الفاتورة / المرجع" value={form.invoiceReference} onChange={(e) => set('invoiceReference', e.target.value)} />
      </FormSectionCard>

      <FormSectionCard
        title="الإهلاك"
        subtitle={
          !isDraft && !isDisposed
            ? 'تغيير العمر أو القيمة التخريدية أو الطريقة يُطبَّق على الأشهر القادمة فقط (معيار 10)، والماضي لا يتغير.'
            : undefined
        }
      >
        <CompactFormField label="طريقة الإهلاك" required>
          <select
            className={compactControlClass}
            value={form.depreciationMethod}
            disabled={lockEstimates}
            onChange={(e) => set('depreciationMethod', e.target.value as DepreciationMethod)}
          >
            {(Object.keys(METHOD_LABELS) as DepreciationMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="العمر الإنتاجي (سنوات)"
          type="number"
          inputMode="decimal"
          step="0.5"
          value={form.usefulLifeYears}
          disabled={lockEstimates || form.depreciationMethod === 'NONE'}
          onChange={(e) => set('usefulLifeYears', e.target.value)}
        />
        {form.depreciationMethod === 'DECLINING_BALANCE' ? (
          <CompactFormField
            label="نسبة القسط المتناقص السنوية %"
            required
            type="number"
            inputMode="decimal"
            value={form.decliningRate}
            disabled={lockEstimates}
            onChange={(e) => set('decliningRate', e.target.value)}
          />
        ) : null}
        <CompactFormField
          label="القيمة التخريدية"
          type="number"
          inputMode="decimal"
          hint="لو تركتها فارغة تُحسب من نسبة الفئة"
          value={form.salvageValue}
          disabled={lockEstimates}
          onChange={(e) => set('salvageValue', e.target.value)}
        />
        <CompactFormField
          label="مجمع إهلاك سابق (أصل قديم)"
          type="number"
          inputMode="decimal"
          hint="الإهلاك المسجل قبل بدء العمل على البرنامج"
          value={form.openingAccumulatedDepreciation}
          disabled={lockFinancial}
          onChange={(e) => set('openingAccumulatedDepreciation', e.target.value)}
        />
        <CompactFormField
          label="مجمع الإهلاك السابق حتى تاريخ"
          type="date"
          value={form.openingDepreciatedThrough}
          disabled={lockFinancial}
          onChange={(e) => set('openingDepreciatedThrough', e.target.value)}
        />
      </FormSectionCard>

      <FormSectionCard title="الحسابات" subtitle="تُملأ من الفئة تلقائيًا، ويمكن تغييرها لهذا الأصل فقط.">
        <CompactFormField label="حساب الأصل (التكلفة)" required>
          <AccountSelect value={form.assetAccountId} disabled={lockFinancial} onChange={(id) => set('assetAccountId', id)} />
        </CompactFormField>
        <CompactFormField label="حساب مجمع الإهلاك" required>
          <AccountSelect
            value={form.accumulatedDepreciationAccountId}
            disabled={lockFinancial}
            onChange={(id) => set('accumulatedDepreciationAccountId', id)}
          />
        </CompactFormField>
        <CompactFormField label="حساب مصروف الإهلاك" required>
          <AccountSelect
            value={form.depreciationExpenseAccountId}
            disabled={lockFinancial}
            onChange={(id) => set('depreciationExpenseAccountId', id)}
          />
        </CompactFormField>
      </FormSectionCard>

      <div className="flex justify-end gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'جارٍ الحفظ…' : asset ? 'حفظ التعديلات' : 'حفظ كمسودة'}
        </Button>
      </div>
    </div>
  );
}
