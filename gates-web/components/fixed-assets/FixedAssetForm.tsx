'use client';

import { Calculator, Landmark, Package } from 'lucide-react';
import { AdvancedFieldsSection, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { PartySelect } from '@/app/components/form/PartySelect';
import { HrEmployeeSelect } from '@/app/components/hr/HrEmployeeSelect';
import { BranchSelect, CategorySelect, CostCenterSelect } from '@/components/fixed-assets/shared';
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

export type AssetForm = {
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

export function assetFormFrom(asset?: FixedAsset | null): AssetForm {
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

/**
 * API body for create/update. Active assets only send descriptive fields and
 * estimates; disposed assets only descriptive fields (the API enforces the same).
 */
export function assetPayload(form: AssetForm, asset?: FixedAsset | null) {
  const isPurchase = form.acquisitionType === 'PURCHASE';
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
  if (!asset) return { ...descriptive, ...estimates, ...financial };
  if (asset.status === 'DISPOSED') return { ...descriptive, version: asset.version };
  if (asset.status !== 'DRAFT') return { ...descriptive, ...estimates, version: asset.version };
  return { ...descriptive, ...estimates, ...financial, version: asset.version };
}

export function AssetCardFields({
  form,
  onChange,
  asset,
}: {
  form: AssetForm;
  onChange: (patch: Partial<AssetForm>) => void;
  asset?: FixedAsset | null;
}) {
  const set = <K extends keyof AssetForm>(key: K, value: AssetForm[K]) => onChange({ [key]: value } as Partial<AssetForm>);
  const lockFinancial = Boolean(asset && asset.status !== 'DRAFT');
  const lockEstimates = asset?.status === 'DISPOSED';
  const isPurchase = form.acquisitionType === 'PURCHASE';

  const applyCategory = (id: string, category?: FixedAssetCategory) => {
    onChange({
      categoryId: id,
      ...(category
        ? {
            depreciationMethod: category.depreciationMethod,
            usefulLifeYears: category.usefulLifeMonths ? String(category.usefulLifeMonths / 12) : form.usefulLifeYears,
            decliningRate: category.decliningRate != null ? String(toNumber(category.decliningRate)) : form.decliningRate,
            assetAccountId: category.assetAccountId ?? '',
            accumulatedDepreciationAccountId: category.accumulatedDepreciationAccountId ?? '',
            depreciationExpenseAccountId: category.depreciationExpenseAccountId ?? '',
            salvageValue:
              form.cost && toNumber(category.salvagePercent) > 0
                ? String(Math.round(toNumber(form.cost) * toNumber(category.salvagePercent)) / 100)
                : form.salvageValue,
          }
        : {}),
    });
  };

  const advancedCount = [
    form.englishName,
    form.serialNumber,
    form.barcode,
    form.location,
    form.branchId,
    form.costCenterId,
    form.custodianEmployeeId,
    form.warrantyExpiry,
    form.notes,
    toNumber(form.openingAccumulatedDepreciation) > 0 ? '1' : '',
  ].filter((v) => String(v ?? '').trim()).length;

  return (
    <form className="w-full text-base" onSubmit={(e) => e.preventDefault()}>
      <FormSectionCard
        title="البيانات الأساسية"
        subtitle={
          lockFinancial
            ? 'الأصل مُفعّل: التكلفة والتواريخ والحسابات لا تتغير إلا بعد إلغاء التفعيل'
            : 'يُحفظ كمسودة، ثم «تفعيل الأصل» من الأعلى'
        }
        icon={Package}
      >
        <CompactFormField
          label="اسم الأصل"
          required
          value={form.arabicName}
          onChange={(e) => set('arabicName', e.target.value)}
          placeholder="مثال: سيارة نقل ربع"
          autoFocus={!asset}
        />
        <CompactFormField
          label="كود الأصل"
          value={form.code}
          disabled={lockFinancial}
          onChange={(e) => set('code', e.target.value)}
          placeholder={asset ? '' : 'تلقائي'}
        />
        <CompactFormField label="الفئة" required>
          <CategorySelect value={form.categoryId} disabled={lockFinancial} onChange={applyCategory} />
        </CompactFormField>
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
          hint="يوم 15 أو قبله: يُهلك نفس الشهر — بعده: من الشهر التالي"
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
          placeholder="0.00"
        />
        {isPurchase ? (
          <>
            <CompactFormField
              label="ضريبة القيمة المضافة (مدخلات)"
              type="number"
              inputMode="decimal"
              value={form.vatAmount}
              disabled={lockFinancial}
              onChange={(e) => set('vatAmount', e.target.value)}
              placeholder="0.00"
            />
            <CompactFormField label="الطرف الدائن" required>
              <select
                className={compactControlClass}
                value={form.creditMode}
                disabled={lockFinancial}
                onChange={(e) => set('creditMode', e.target.value as AssetForm['creditMode'])}
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
        <CompactFormField
          label="رقم الفاتورة / المرجع"
          value={form.invoiceReference}
          onChange={(e) => set('invoiceReference', e.target.value)}
        />
      </FormSectionCard>

      <FormSectionCard
        title="الإهلاك"
        subtitle={
          asset && asset.status !== 'DRAFT' && !lockEstimates
            ? 'تغيير العمر أو القيمة التخريدية أو الطريقة يُطبَّق على الأشهر القادمة فقط (معيار 10)'
            : 'تُملأ من الفئة تلقائيًا ويمكن تعديلها لهذا الأصل'
        }
        icon={Calculator}
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
          placeholder="0"
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
          hint="فارغة = من نسبة الفئة"
          value={form.salvageValue}
          disabled={lockEstimates}
          onChange={(e) => set('salvageValue', e.target.value)}
          placeholder="0.00"
        />
      </FormSectionCard>

      <FormSectionCard title="الحسابات" subtitle="من الفئة — ويمكن تغييرها لهذا الأصل فقط" icon={Landmark}>
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

      <AdvancedFieldsSection title="الموقع والعهدة والبيانات الإضافية" badgeCount={advancedCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="الفرع">
            <BranchSelect value={form.branchId} onChange={(id) => set('branchId', id)} />
          </CompactFormField>
          <CompactFormField label="مركز التكلفة" hint="يُحمّل عليه مصروف الإهلاك">
            <CostCenterSelect value={form.costCenterId} onChange={(id) => set('costCenterId', id)} />
          </CompactFormField>
          <CompactFormField label="الموظف صاحب العهدة">
            <HrEmployeeSelect value={form.custodianEmployeeId} onChange={(id) => set('custodianEmployeeId', id)} />
          </CompactFormField>
          <CompactFormField label="الموقع" value={form.location} onChange={(e) => set('location', e.target.value)} />
          <CompactFormField label="الرقم التسلسلي" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
          <CompactFormField label="الباركود" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          <CompactFormField label="انتهاء الضمان" type="date" value={form.warrantyExpiry} onChange={(e) => set('warrantyExpiry', e.target.value)} />
          <CompactFormField label="الاسم الإنجليزي" value={form.englishName} onChange={(e) => set('englishName', e.target.value)} />
          <CompactFormField label="ملاحظات" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
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
        </div>
      </AdvancedFieldsSection>
    </form>
  );
}
