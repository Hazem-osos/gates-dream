'use client';

import { useState } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import {
  AdvancedFieldsSection,
  AppTable,
  CompactFormField,
  FormSectionCard,
  Switch,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CategorySelect, FA_CRUMB, useFixedAssetCategories } from '@/components/fixed-assets/shared';
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

export default function FixedAssetCategoryCardPage() {
  const { data } = useFixedAssetCategories();
  const invalidate = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const rows = data?.data ?? [];
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setSelectedId(null);
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
      if (selectedId) {
        await apiClient.put(`/fixed-assets/categories/${selectedId}`, body);
      } else {
        const res = await apiClient.post<FixedAssetCategory>('/fixed-assets/categories', body);
        if (res.data?.id) setSelectedId(res.data.id);
      }
      invalidate(queryKeys.fixedAssets.categories());
    } catch {
      /* the API client shows the error */
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm(`حذف الفئة ${form.arabicName}؟`)) return;
    try {
      await apiClient.delete(`/fixed-assets/categories/${selectedId}`);
      invalidate(queryKeys.fixedAssets.categories());
      reset();
    } catch {
      /* shown by the API client */
    }
  };

  const advancedCount = [form.englishName, form.parentId, form.isActive ? '' : '1'].filter(Boolean).length;

  return (
    <MasterCardShell
      title="فئة أصول"
      breadcrumbs={[FA_CRUMB, { label: 'فئات الأصول' }]}
      docNumber={form.code || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void save()}
      savePending={saving}
      canSave={!saving}
      onNew={reset}
      onDelete={() => void remove()}
      deleteDisabled={!selectedId}
      currentId={selectedId}
      onBrowseList={() => setBrowseOpen(true)}
      favoriteHref="/fixed-assets/categories"
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="كل أصل يأخذ طريقة وعمر إهلاكه من فئته" icon={Layers}>
        <CompactFormField label="كود الفئة" required value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="مثال: VEH" />
        <CompactFormField
          label="اسم الفئة"
          required
          value={form.arabicName}
          onChange={(e) => set('arabicName', e.target.value)}
          placeholder="مثال: سيارات"
          autoFocus
        />
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
          placeholder="0"
        />
        {form.depreciationMethod === 'DECLINING_BALANCE' ? (
          <CompactFormField
            label="نسبة القسط المتناقص السنوية %"
            required
            type="number"
            inputMode="decimal"
            value={form.decliningRate}
            onChange={(e) => set('decliningRate', e.target.value)}
            placeholder="25"
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
      </FormSectionCard>

      <FormSectionCard
        title="الحسابات"
        subtitle="تُنسخ على كل أصل جديد في الفئة؛ تعديلها لا يغيّر الأصول المسجلة قبله"
        icon={BookOpen}
      >
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
          <AccountSelect value={form.disposalGainAccountId} onChange={(id) => set('disposalGainAccountId', id)} statementType="INCOME_STATEMENT" />
        </CompactFormField>
        <CompactFormField label="حساب خسائر استبعاد الأصول">
          <AccountSelect value={form.disposalLossAccountId} onChange={(id) => set('disposalLossAccountId', id)} statementType="INCOME_STATEMENT" />
        </CompactFormField>
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="الاسم الإنجليزي" value={form.englishName} onChange={(e) => set('englishName', e.target.value)} />
          <CompactFormField label="الفئة الأب (اختياري)">
            <CategorySelect value={form.parentId} onChange={(id) => set('parentId', id)} emptyLabel="— فئة رئيسية —" excludeId={selectedId ?? undefined} />
          </CompactFormField>
          <CompactFormField label="حالة الفئة">
            <Switch checked={form.isActive} onCheckedChange={(checked) => set('isActive', checked)} label="فئة نشطة" />
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="فئات الأصول">
        <AppTable<FixedAssetCategory>
          data={rows}
          getRowKey={(r) => r.id}
          emptyTitle="لا توجد فئات أصول بعد"
          onRowClick={(r) => {
            setSelectedId(r.id);
            setForm(fromRow(r));
            setBrowseOpen(false);
          }}
          rowClassName={(r) => (selectedId === r.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined)}
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
            { id: 'count', header: 'الأصول', numeric: true, cell: (r) => String(r._count?.assets ?? 0) },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
