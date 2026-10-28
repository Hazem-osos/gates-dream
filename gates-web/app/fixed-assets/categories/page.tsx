'use client';

import { useState } from 'react';
import { AppTable, Button, CompactFormField, FormSectionCard } from '@/app/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CategorySelect, FixedAssetsPage, useFixedAssetCategories } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { METHOD_LABELS, toNumber, type DepreciationMethod, type FixedAssetCategory } from '@/lib/fixed-assets/types';

type Form = {
  code: string;
  arabicName: string;
  englishName: string;
  parentId: string;
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: string;
  decliningRate: string;
  salvagePercent: string;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  disposalGainAccountId: string;
  disposalLossAccountId: string;
  isActive: boolean;
};

const EMPTY: Form = {
  code: '',
  arabicName: '',
  englishName: '',
  parentId: '',
  depreciationMethod: 'STRAIGHT_LINE',
  usefulLifeYears: '',
  decliningRate: '',
  salvagePercent: '0',
  assetAccountId: '',
  accumulatedDepreciationAccountId: '',
  depreciationExpenseAccountId: '',
  disposalGainAccountId: '',
  disposalLossAccountId: '',
  isActive: true,
};

function fromRow(row: FixedAssetCategory): Form {
  return {
    code: row.code,
    arabicName: row.arabicName,
    englishName: row.englishName ?? '',
    parentId: row.parentId ?? '',
    depreciationMethod: row.depreciationMethod,
    usefulLifeYears: row.usefulLifeMonths ? String(row.usefulLifeMonths / 12) : '',
    decliningRate: row.decliningRate != null ? String(toNumber(row.decliningRate)) : '',
    salvagePercent: String(toNumber(row.salvagePercent)),
    assetAccountId: row.assetAccountId ?? '',
    accumulatedDepreciationAccountId: row.accumulatedDepreciationAccountId ?? '',
    depreciationExpenseAccountId: row.depreciationExpenseAccountId ?? '',
    disposalGainAccountId: row.disposalGainAccountId ?? '',
    disposalLossAccountId: row.disposalLossAccountId ?? '',
    isActive: row.isActive,
  };
}

export default function FixedAssetCategoriesPage() {
  const { data, isLoading } = useFixedAssetCategories();
  const invalidate = useInvalidateQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const rows = data?.data ?? [];
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const save = async () => {
    const years = Number(form.usefulLifeYears);
    const body = {
      code: form.code.trim(),
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || null,
      parentId: form.parentId || null,
      depreciationMethod: form.depreciationMethod,
      usefulLifeMonths: years > 0 ? Math.round(years * 12) : null,
      decliningRate: form.depreciationMethod === 'DECLINING_BALANCE' ? Number(form.decliningRate) || null : null,
      salvagePercent: Number(form.salvagePercent) || 0,
      assetAccountId: form.assetAccountId,
      accumulatedDepreciationAccountId: form.accumulatedDepreciationAccountId,
      depreciationExpenseAccountId: form.depreciationExpenseAccountId,
      disposalGainAccountId: form.disposalGainAccountId || null,
      disposalLossAccountId: form.disposalLossAccountId || null,
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (editingId) await apiClient.put(`/fixed-assets/categories/${editingId}`, body);
      else await apiClient.post('/fixed-assets/categories', body);
      invalidate(queryKeys.fixedAssets.categories());
      reset();
    } catch {
      /* the API client shows the error */
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: FixedAssetCategory) => {
    if (!window.confirm(`حذف الفئة ${row.arabicName}؟`)) return;
    try {
      await apiClient.delete(`/fixed-assets/categories/${row.id}`);
      invalidate(queryKeys.fixedAssets.categories());
      if (editingId === row.id) reset();
    } catch {
      /* shown by the API client */
    }
  };

  return (
    <FixedAssetsPage title="فئات الأصول" description="كل أصل يأخذ حساباته وطريقة وعمر إهلاكه من فئته، ويمكن تعديلها على الأصل نفسه.">
      <FormSectionCard
        title={editingId ? 'تعديل فئة' : 'فئة جديدة'}
        subtitle="تعديل الفئة لا يغيّر الأصول المسجلة قبله — كل أصل يحتفظ بنسخته من الحسابات والتقديرات."
        headerActions={
          <>
            <Button onClick={save} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </Button>
            {editingId ? (
              <Button variant="ghost" onClick={reset}>
                إلغاء
              </Button>
            ) : null}
          </>
        }
      >
        <CompactFormField label="الكود" required value={form.code} onChange={(e) => set('code', e.target.value)} />
        <CompactFormField label="الاسم العربي" required value={form.arabicName} onChange={(e) => set('arabicName', e.target.value)} />
        <CompactFormField label="الاسم الإنجليزي" value={form.englishName} onChange={(e) => set('englishName', e.target.value)} />
        <CompactFormField label="الفئة الأب">
          <CategorySelect value={form.parentId} onChange={(id) => set('parentId', id)} emptyLabel="— بدون —" excludeId={editingId ?? undefined} />
        </CompactFormField>
        <CompactFormField label="طريقة الإهلاك" required>
          <select
            className={compactControlClass}
            value={form.depreciationMethod}
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
          min={0}
          step="0.5"
          value={form.usefulLifeYears}
          disabled={form.depreciationMethod === 'NONE'}
          onChange={(e) => set('usefulLifeYears', e.target.value)}
        />
        {form.depreciationMethod === 'DECLINING_BALANCE' ? (
          <CompactFormField
            label="نسبة القسط المتناقص السنوية %"
            required
            type="number"
            inputMode="decimal"
            value={form.decliningRate}
            onChange={(e) => set('decliningRate', e.target.value)}
          />
        ) : null}
        <CompactFormField
          label="القيمة التخريدية % من التكلفة"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          value={form.salvagePercent}
          onChange={(e) => set('salvagePercent', e.target.value)}
        />
        <CompactFormField label="حساب الأصل (التكلفة)" required>
          <AccountSelect value={form.assetAccountId} onChange={(id) => set('assetAccountId', id)} />
        </CompactFormField>
        <CompactFormField label="حساب مجمع الإهلاك" required>
          <AccountSelect value={form.accumulatedDepreciationAccountId} onChange={(id) => set('accumulatedDepreciationAccountId', id)} />
        </CompactFormField>
        <CompactFormField label="حساب مصروف الإهلاك" required>
          <AccountSelect
            value={form.depreciationExpenseAccountId}
            onChange={(id) => set('depreciationExpenseAccountId', id)}
            statementType="INCOME_STATEMENT"
          />
        </CompactFormField>
        <CompactFormField label="حساب أرباح بيع الأصول">
          <AccountSelect value={form.disposalGainAccountId} onChange={(id) => set('disposalGainAccountId', id)} />
        </CompactFormField>
        <CompactFormField label="حساب خسائر استبعاد الأصول">
          <AccountSelect value={form.disposalLossAccountId} onChange={(id) => set('disposalLossAccountId', id)} />
        </CompactFormField>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          فئة نشطة
        </label>
      </FormSectionCard>

      <AppTable<FixedAssetCategory>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد فئات أصول بعد"
        emptyDescription="ابدأ بتعريف فئة مثل: مباني، سيارات، أجهزة حاسب، أثاث."
        exportFileName="fixed-asset-categories"
        columns={[
          { id: 'code', header: 'الكود', accessor: 'code' },
          { id: 'name', header: 'الفئة', accessor: 'arabicName' },
          { id: 'method', header: 'الطريقة', cell: (r) => METHOD_LABELS[r.depreciationMethod] },
          {
            id: 'life',
            header: 'العمر / النسبة',
            cell: (r) =>
              r.depreciationMethod === 'DECLINING_BALANCE'
                ? `${toNumber(r.decliningRate)}% سنويًا`
                : r.usefulLifeMonths
                  ? `${r.usefulLifeMonths / 12} سنة`
                  : '—',
          },
          { id: 'asset', header: 'حساب الأصل', cell: (r) => (r.assetAccount ? `${r.assetAccount.code} - ${r.assetAccount.arabicName}` : '—') },
          {
            id: 'acc',
            header: 'مجمع الإهلاك',
            cell: (r) =>
              r.accumulatedDepreciationAccount
                ? `${r.accumulatedDepreciationAccount.code} - ${r.accumulatedDepreciationAccount.arabicName}`
                : '—',
          },
          { id: 'count', header: 'عدد الأصول', numeric: true, cell: (r) => String(r._count?.assets ?? 0) },
          {
            id: 'actions',
            header: '',
            cell: (r) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(r.id);
                    setForm(fromRow(r));
                  }}
                >
                  تعديل
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(r)}>
                  حذف
                </Button>
              </div>
            ),
          },
        ]}
      />
    </FixedAssetsPage>
  );
}
