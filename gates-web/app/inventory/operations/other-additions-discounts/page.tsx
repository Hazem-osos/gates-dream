'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Percent, Plus, Trash2 } from 'lucide-react';
import {
  PageHeader,
  Button,
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
  CrudButtons,
} from '@/components/ui';
import { AccountSelect } from '@/components/form/AccountSelect';
import { ItemSelect } from '@/components/form/ItemSelect';
import { CustomerSelect, SupplierSelect } from '@/components/form/PartySelect';
import {
  OtherAdditionsListSection,
  type OtherAdditionRow,
} from '@/components/inventory/OtherAdditionsListSection';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type ScopeTab = 'activities' | 'items' | 'groups' | 'suppliers' | 'customers';

type ScopeRow = {
  sourceId: string;
  sourceName: string;
  percentage: string;
};

type FormState = {
  serial: string;
  name: string;
  abbreviation: string;
  accountId: string;
  offsetAccountId: string;
  isActive: boolean;
  base: 'amount' | 'discount-origin';
  type: 'addition' | 'discount';
};

const SCOPE_TABS: { id: ScopeTab; label: string; hint: string }[] = [
  { id: 'activities', label: 'الأنشطة', hint: 'نسبة حسب نوع الحركة' },
  { id: 'items', label: 'الأصناف', hint: 'نسبة لصنف معيّن' },
  { id: 'groups', label: 'المجموعات', hint: 'نسبة لمجموعة أصناف' },
  { id: 'suppliers', label: 'الموردين', hint: 'نسبة لمورد' },
  { id: 'customers', label: 'العملاء', hint: 'نسبة لعميل' },
];

const ACTIVITIES = [
  { id: 'sales', label: 'المبيعات' },
  { id: 'purchase', label: 'المشتريات' },
  { id: 'sales-return', label: 'مردود المبيعات' },
  { id: 'purchase-return', label: 'مردود المشتريات' },
  { id: 'pos', label: 'نقطة البيع' },
];

const emptyScope = (): Record<ScopeTab, ScopeRow[]> => ({
  activities: [{ sourceId: '', sourceName: '', percentage: '' }],
  items: [{ sourceId: '', sourceName: '', percentage: '' }],
  groups: [{ sourceId: '', sourceName: '', percentage: '' }],
  suppliers: [{ sourceId: '', sourceName: '', percentage: '' }],
  customers: [{ sourceId: '', sourceName: '', percentage: '' }],
});

const emptyForm = (): FormState => ({
  serial: '',
  name: '',
  abbreviation: '',
  accountId: '',
  offsetAccountId: '',
  isActive: true,
  base: 'amount',
  type: 'addition',
});

const checkboxCls =
  'h-4 w-4 rounded border-[#0E78AA] text-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]/20';

function asPercent(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

export default function OtherAdditionsDiscountsPage() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [defaultRates, setDefaultRates] = useState<string[]>(['']);
  const [scopeRows, setScopeRows] = useState(emptyScope);
  const [activeTab, setActiveTab] = useState<ScopeTab>('customers');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: groupsResponse } = useApiQuery<{ id: string; arabicName: string }[]>(
    queryKeys.itemCategories({ limit: 200 }),
    '/inventory/item-categories',
    { limit: 200, isActive: true }
  );
  const groups = groupsResponse?.data ?? [];

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  const applyRow = (row: OtherAdditionRow) => {
    setSelectedId(row.id);
    setForm({
      serial: row.serial ?? '',
      name: row.name ?? '',
      abbreviation: row.abbreviation ?? '',
      accountId: row.accountId ?? '',
      offsetAccountId: row.offsetAccountId ?? '',
      isActive: row.isActive !== false,
      base: row.base === 'discount-origin' ? 'discount-origin' : 'amount',
      type: row.type === 'discount' ? 'discount' : 'addition',
    });
    const sourceAlias: Record<string, ScopeTab | 'default'> = {
      default: 'default',
      activities: 'activities',
      items: 'items',
      groups: 'groups',
      suppliers: 'suppliers',
      customers: 'customers',
      الأنشطة: 'activities',
      الأنماط: 'activities',
      الأصناف: 'items',
      المجموعات: 'groups',
      الموردين: 'suppliers',
      العملاء: 'customers',
    };
    const next = emptyScope();
    const rates: string[] = [];
    for (const p of row.percentages ?? []) {
      const pct = asPercent(p.percentage);
      const mapped = sourceAlias[p.source] ?? (!p.sourceId ? 'default' : undefined);
      if (mapped === 'default' || mapped == null) {
        if (mapped === 'default') rates.push(pct);
        continue;
      }
      next[mapped].push({
        sourceId: p.sourceId ?? '',
        sourceName: p.sourceName ?? '',
        percentage: pct,
      });
    }
    (Object.keys(next) as ScopeTab[]).forEach((tab) => {
      if (next[tab].length === 0) next[tab] = [{ sourceId: '', sourceName: '', percentage: '' }];
    });
    setScopeRows(next);
    setDefaultRates(rates.length ? rates : ['']);
    setError('');
  };

  const buildPercentages = () => {
    const rows: {
      source: 'default' | ScopeTab;
      sourceId?: string | null;
      sourceName?: string | null;
      percentage: number;
    }[] = [];
    for (const rate of defaultRates) {
      const n = parseFloat(rate);
      if (Number.isFinite(n)) rows.push({ source: 'default', percentage: n });
    }
    for (const tab of SCOPE_TABS) {
      for (const row of scopeRows[tab.id]) {
        const n = parseFloat(row.percentage);
        if (!row.sourceId && !row.sourceName && !Number.isFinite(n)) continue;
        if (!Number.isFinite(n)) continue;
        rows.push({
          source: tab.id,
          sourceId: row.sourceId || null,
          sourceName: row.sourceName || null,
          percentage: n,
        });
      }
    }
    return rows;
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.name.trim()) {
      setError('يرجى إدخال الاسم');
      return;
    }
    const body = {
      serial: form.serial || undefined,
      name: form.name.trim(),
      accountId: form.accountId || null,
      offsetAccountId: form.offsetAccountId || null,
      abbreviation: form.abbreviation || null,
      isActive: form.isActive,
      base: form.base,
      type: form.type,
      percentages: buildPercentages(),
    };
    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put(`/inventory/other-addition-discount-types/${selectedId}`, body);
        setSuccess('تم تحديث الإضافة / الخصم');
      } else {
        const res = await apiClient.post<OtherAdditionRow>(
          '/inventory/other-addition-discount-types',
          body
        );
        if (res.data?.id) setSelectedId(res.data.id);
        setSuccess('تم حفظ الإضافة / الخصم');
      }
      invalidateQuery(['other-addition-discount-types']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setDefaultRates(['']);
    setScopeRows(emptyScope());
    setError('');
    setSuccess('');
  };

  const updateScope = (tab: ScopeTab, index: number, next: Partial<ScopeRow>) => {
    setScopeRows((prev) => ({
      ...prev,
      [tab]: prev[tab].map((row, i) => (i === index ? { ...row, ...next } : row)),
    }));
  };

  const activeHint = SCOPE_TABS.find((t) => t.id === activeTab)?.hint ?? '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageHeader
        title="إضافات وخصومات أخرى"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'العمليات' },
          { label: 'إضافات وخصومات أخرى' },
        ]}
        actions={
          <CrudButtons
            onPrevious={() => router.back()}
            onAdd={handleNew}
            extraItems={[
              {
                id: 'archive',
                label: selectedId && !form.isActive ? 'تفعيل' : 'إيقاف',
                onClick: () => patch({ isActive: !form.isActive }),
              },
            ]}
          />
        }
      />

      <OtherAdditionsListSection onSelect={applyRow} selectedId={selectedId} />

      <FormSectionCard
        title="تعريف الإضافة أو الخصم"
        subtitle="الاسم والحسابات. التوزيع على المصادر تحت."
        icon={Percent}
      >
        <CompactFormField
          label="المسلسل"
          value={form.serial}
          onChange={(e) => patch({ serial: e.target.value })}
        />
        <CompactFormField
          label="الاسم"
          required
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="مثلاً دمغة"
        />
        <CompactFormField
          label="الاسم المختصر"
          value={form.abbreviation}
          onChange={(e) => patch({ abbreviation: e.target.value })}
        />
        <CompactFormField label="الحساب">
          <AccountSelect
            value={form.accountId}
            onChange={(accountId) => patch({ accountId })}
            leafOnly
            placeholder="حساب الإضافة أو الخصم"
          />
        </CompactFormField>
        <CompactFormField label="حساب معادل الخصم أو الإضافة">
          <AccountSelect
            value={form.offsetAccountId}
            onChange={(offsetAccountId) => patch({ offsetAccountId })}
            leafOnly
            placeholder="الحساب المقابل — اختياري"
          />
        </CompactFormField>
        <CompactFormField label="نشط">
          <label className="flex h-9 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className={checkboxCls}
              checked={form.isActive}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />
            <span className="text-sm font-semibold text-[#0A3D5E]">نشط</span>
          </label>
        </CompactFormField>
      </FormSectionCard>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
        <section className="rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-zinc-900">طريقة الحساب</h2>
          <p className="mb-4 text-xs text-slate-500">الأساس على المبلغ الأصلي ولا على خصم الصنف، وإضافة ولا خصم.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">الأساس</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['amount', 'أصل المبلغ'],
                    ['discount-origin', 'أصل - خصم الصنف'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`${
                      form.base === value
                        ? 'border-[#0E78AA] bg-[#E8F4FA] text-[#0E78AA]'
                        : 'border-[#D6EAF3] bg-white text-[#0A3D5E]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={form.base === value}
                      onChange={() => patch({ base: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">النوع</p>
              <div className="flex flex-wrap gap-2">
                <label
                  className={`${
                    form.type === 'addition'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-[#D6EAF3] bg-white text-[#0A3D5E]'
                  } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.type === 'addition'}
                    onChange={() => patch({ type: 'addition' })}
                  />
                  إضافة
                </label>
                <label
                  className={`${
                    form.type === 'discount'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-[#D6EAF3] bg-white text-[#0A3D5E]'
                  } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.type === 'discount'}
                    onChange={() => patch({ type: 'discount' })}
                  />
                  خصم
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-zinc-900">النسب العامة %</h2>
          <p className="mb-3 text-xs text-slate-500">تُستخدم لو مفيش نسبة خاصة بالمصدر.</p>
          <div className="space-y-2">
            {defaultRates.map((rate, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={rate}
                  onChange={(e) =>
                    setDefaultRates((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                  placeholder="%"
                />
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() =>
                    setDefaultRates((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']))
                  }
                  aria-label="حذف النسبة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDefaultRates((prev) => [...prev, ''])}
            >
              <Plus className="h-4 w-4" />
              نسبة
            </Button>
          </div>
        </section>
      </div>

      <section className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <header className="mb-3">
          <h2 className="text-sm font-bold text-zinc-900">توزيع النسب على المصادر</h2>
          <p className="mt-0.5 text-xs text-slate-500">{activeHint}</p>
        </header>
        <div className="mb-4 flex flex-wrap gap-2">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === tab.id
                  ? 'bg-[#E8F4FA] text-[#0E78AA] ring-1 ring-[#B7E0F2]'
                  : 'border border-[#D6EAF3] bg-white text-[#0A3D5E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl">
          <table className="min-w-full border-separate border-spacing-0 text-center">
            <thead>
              <tr className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white">
                <th className="px-3 py-3 font-semibold">المصدر</th>
                <th className="w-40 px-3 py-3 font-semibold">النسبة %</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {scopeRows[activeTab].map((row, idx) => (
                <tr key={`${activeTab}-${idx}`} className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                  <td className="border-x border-[#D6EAF3] px-2 py-2 text-right">
                    {activeTab === 'activities' && (
                      <select
                        className={compactControlClass}
                        value={row.sourceId}
                        onChange={(e) => {
                          const opt = ACTIVITIES.find((a) => a.id === e.target.value);
                          updateScope('activities', idx, {
                            sourceId: e.target.value,
                            sourceName: opt?.label ?? '',
                          });
                        }}
                      >
                        <option value="">اختر النشاط</option>
                        {ACTIVITIES.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {activeTab === 'items' && (
                      <ItemSelect
                        value={row.sourceId}
                        emptyLabel="اختر الصنف"
                        menuPlacement="bottom"
                        onChange={(id) => updateScope('items', idx, { sourceId: id })}
                        onItemResolved={(item) =>
                          updateScope('items', idx, {
                            sourceId: item?.id ?? row.sourceId,
                            sourceName: item?.arabicName ?? row.sourceName,
                          })
                        }
                      />
                    )}
                    {activeTab === 'groups' && (
                      <select
                        className={compactControlClass}
                        value={row.sourceId}
                        onChange={(e) => {
                          const g = groups.find((x) => x.id === e.target.value);
                          updateScope('groups', idx, {
                            sourceId: e.target.value,
                            sourceName: g?.arabicName ?? '',
                          });
                        }}
                      >
                        <option value="">اختر المجموعة</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.arabicName}
                          </option>
                        ))}
                      </select>
                    )}
                    {activeTab === 'suppliers' && (
                      <SupplierSelect
                        value={row.sourceId}
                        emptyLabel="اختر المورد"
                        onChange={(id) => updateScope('suppliers', idx, { sourceId: id, sourceName: id })}
                      />
                    )}
                    {activeTab === 'customers' && (
                      <CustomerSelect
                        value={row.sourceId}
                        emptyLabel="اختر العميل"
                        onChange={(id) => updateScope('customers', idx, { sourceId: id, sourceName: id })}
                      />
                    )}
                  </td>
                  <td className="border-x border-[#D6EAF3] px-2 py-2">
                    <input
                      className={compactControlClass}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.percentage}
                      onChange={(e) => updateScope(activeTab, idx, { percentage: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-500"
                      onClick={() =>
                        setScopeRows((prev) => ({
                          ...prev,
                          [activeTab]:
                            prev[activeTab].length > 1
                              ? prev[activeTab].filter((_, i) => i !== idx)
                              : [{ sourceId: '', sourceName: '', percentage: '' }],
                        }))
                      }
                      aria-label="حذف السطر"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() =>
            setScopeRows((prev) => ({
              ...prev,
              [activeTab]: [...prev[activeTab], { sourceId: '', sourceName: '', percentage: '' }],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          سطر
        </Button>
      </section>

      <FormStickyFooter
        onCancel={() => router.back()}
        onSave={() => void handleSave()}
        saveLoading={saving}
        saveDisabled={saving}
        status={selectedId ? 'تعديل' : 'مسودة'}
      />
    </div>
  );
}
