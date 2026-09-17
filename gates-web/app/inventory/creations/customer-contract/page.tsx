'use client';

import { useMemo, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  AppTable,
  FilterToolbar,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { CustomerSelect } from '@/components/form/PartySelect';
import {
  CustomerContractsListSection,
  type CustomerContractRow,
} from '@/components/inventory/CustomerContractsListSection';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type ContractType = 'نقدي' | 'آجل' | 'جزء نقدي وجزء آجل' | 'حسب الصنف';

type FormState = {
  code: string;
  customerId: string;
  contractType: ContractType;
  cashPercentage: string;
  creditPercentage: string;
  daysCount: string;
};

type GroupLine = {
  key: string;
  categoryId: string;
  groupNumber: string;
  groupName: string;
  days: string;
  [key: string]: unknown;
};

type ApiGroup = {
  id?: string;
  categoryId?: string | null;
  groupNumber?: string | null;
  groupName?: string | null;
  days?: number | null;
  category?: { id?: string; code?: string | null; arabicName?: string } | null;
};

type ApiDetail = CustomerContractRow & { groups?: ApiGroup[] };

type ItemGroup = { id: string; code?: string | null; arabicName: string };

const TYPES: { id: ContractType; label: string }[] = [
  { id: 'نقدي', label: 'نقدي' },
  { id: 'آجل', label: 'آجل' },
  { id: 'جزء نقدي وجزء آجل', label: 'جزء نقدي وجزء آجل' },
  { id: 'حسب الصنف', label: 'حسب الصنف' },
];

const emptyForm = (): FormState => ({
  code: '',
  customerId: '',
  contractType: 'نقدي',
  cashPercentage: '100',
  creditPercentage: '0',
  daysCount: '',
});

const emptyGroup = (): GroupLine => ({
  key: crypto.randomUUID(),
  categoryId: '',
  groupNumber: '',
  groupName: '',
  days: '',
});

const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function defaultsForType(type: ContractType): Partial<FormState> {
  if (type === 'نقدي') return { contractType: type, cashPercentage: '100', creditPercentage: '0' };
  if (type === 'آجل') return { contractType: type, cashPercentage: '0', creditPercentage: '100' };
  if (type === 'جزء نقدي وجزء آجل') return { contractType: type };
  return { contractType: type };
}

function lineFromApi(row: ApiGroup): GroupLine {
  return {
    key: crypto.randomUUID(),
    categoryId: row.categoryId || row.category?.id || '',
    groupNumber: row.groupNumber || row.category?.code || '',
    groupName: row.groupName || row.category?.arabicName || '',
    days: row.days != null ? String(row.days) : '',
  };
}

export default function CustomerContractPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [groups, setGroups] = useState<GroupLine[]>([emptyGroup(), emptyGroup()]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: groupsResponse } = useApiQuery<ItemGroup[]>(
    queryKeys.itemCategories({ limit: 300 }),
    '/inventory/item-categories',
    { limit: 300, isActive: true }
  );
  const itemGroups = groupsResponse?.data ?? [];

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));
  const patchGroup = (key: string, next: Partial<GroupLine>) => {
    setGroups((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const hydrate = (detail: ApiDetail) => {
    setSelectedId(detail.id);
    setForm({
      code: detail.code ?? '',
      customerId: detail.customerId ?? '',
      contractType: (TYPES.some((t) => t.id === detail.contractType)
        ? detail.contractType
        : 'نقدي') as ContractType,
      cashPercentage: detail.cashPercentage != null ? String(detail.cashPercentage) : '',
      creditPercentage: detail.creditPercentage != null ? String(detail.creditPercentage) : '',
      daysCount: detail.daysCount != null ? String(detail.daysCount) : '',
    });
    const next = (detail.groups ?? []).map(lineFromApi);
    setGroups(next.length ? next : [emptyGroup(), emptyGroup()]);
  };

  const loadContract = async (id: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await apiClient.get<ApiDetail>(`/inventory/customer-contracts/${id}`);
      if (res.data) hydrate(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل التعاقد');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setGroups([emptyGroup(), emptyGroup()]);
    setError('');
    setSuccess('');
  };

  const addGroup = () => setGroups((prev) => [...prev, emptyGroup()]);

  const applyCategory = (key: string, categoryId: string) => {
    const cat = itemGroups.find((g) => g.id === categoryId);
    patchGroup(key, {
      categoryId,
      groupNumber: cat?.code ?? '',
      groupName: cat?.arabicName ?? '',
    });
  };

  const setType = (type: ContractType) => {
    setForm((prev) => ({ ...prev, ...defaultsForType(type) }));
  };

  const visible = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim();
    return groups.filter((row) => `${row.groupNumber} ${row.groupName}`.includes(q));
  }, [groups, search]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.customerId) {
      setError('يرجى اختيار العميل');
      return;
    }
    if (form.contractType === 'جزء نقدي وجزء آجل') {
      const cash = num(form.cashPercentage) ?? 0;
      const credit = num(form.creditPercentage) ?? 0;
      if (Math.abs(cash + credit - 100) > 0.01) {
        setError('مجموع نسبة النقدي والآجل لازم يساوي 100%');
        return;
      }
    }
    const body = {
      code: form.code || null,
      customerId: form.customerId,
      contractType: form.contractType,
      cashPercentage: num(form.cashPercentage),
      creditPercentage: num(form.creditPercentage),
      daysCount: num(form.daysCount) != null ? Math.round(num(form.daysCount) as number) : null,
      groups: groups
        .filter((g) => g.categoryId || g.groupName || g.days)
        .map((g) => ({
          categoryId: g.categoryId || null,
          groupNumber: g.groupNumber || null,
          groupName: g.groupName || null,
          days: num(g.days) != null ? Math.round(num(g.days) as number) : null,
        })),
    };
    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put<ApiDetail>(`/inventory/customer-contracts/${selectedId}`, body);
      } else {
        await apiClient.post<ApiDetail>('/inventory/customer-contracts', body);
      }
      invalidateQuery(['customer-contracts']);
      handleNew();
      setSuccess('تم حفظ التعاقد — تقدر تضيف التالي');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setError('');
    try {
      await apiClient.delete(`/inventory/customer-contracts/${selectedId}`);
      handleNew();
      setSuccess('تم حذف التعاقد');
      invalidateQuery(['customer-contracts']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <MasterCardShell
      title="تعاقد عميل"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'تعاقد عميل' },
      ]}
      docNumber={form.code || 'جديد'}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={handleNew}
      onDelete={selectedId ? () => void handleDelete() : undefined}
      currentId={selectedId}
      favoriteHref="/inventory/creations/customer-contract"
      moreMenuItems={[{ id: 'add-group', label: 'إضافة مجموعة', onClick: addGroup }]}
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <CustomerContractsListSection
        onSelect={(row) => void loadContract(row.id)}
        selectedId={selectedId}
      />

      <FormSectionCard title="بيانات التعاقد" subtitle="الكود والعميل ونوع السداد" icon={FileText}>
        <CompactFormField label="الكود" value={form.code} onChange={(e) => patch({ code: e.target.value })} />
        <CompactFormField label="العميل" required>
          <CustomerSelect
            value={form.customerId}
            onChange={(customerId) => patch({ customerId })}
            emptyLabel="اختر العميل"
          />
        </CompactFormField>
        <CompactFormField
          label="نسبة النقدي"
          type="number"
          step="0.01"
          min="0"
          max="100"
          suffix="%"
          value={form.cashPercentage}
          onChange={(e) => {
            const cash = e.target.value;
            if (form.contractType === 'جزء نقدي وجزء آجل') {
              const n = parseFloat(cash);
              patch({
                cashPercentage: cash,
                creditPercentage: Number.isFinite(n) ? String(Math.max(0, +(100 - n).toFixed(2))) : form.creditPercentage,
              });
              return;
            }
            patch({ cashPercentage: cash });
          }}
        />
        <CompactFormField
          label="نسبة الآجل"
          type="number"
          step="0.01"
          min="0"
          max="100"
          suffix="%"
          value={form.creditPercentage}
          onChange={(e) => {
            const credit = e.target.value;
            if (form.contractType === 'جزء نقدي وجزء آجل') {
              const n = parseFloat(credit);
              patch({
                creditPercentage: credit,
                cashPercentage: Number.isFinite(n) ? String(Math.max(0, +(100 - n).toFixed(2))) : form.cashPercentage,
              });
              return;
            }
            patch({ creditPercentage: credit });
          }}
        />
        <CompactFormField
          label="عدد الأيام"
          type="number"
          min="0"
          value={form.daysCount}
          onChange={(e) => patch({ daysCount: e.target.value })}
        />
      </FormSectionCard>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#E6F0F7] bg-white p-3">
        <span className="text-sm font-semibold text-[#0A3D5E]">نوع التعاقد</span>
        {TYPES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={form.contractType === opt.id}
            onClick={() => setType(opt.id)}
            className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
              form.contractType === opt.id
                ? 'border-[#0E78AA] bg-[#E8F4FA] text-[#0E78AA]'
                : 'border-[#D6EAF3] bg-white text-[#0A3D5E] hover:bg-[#F6FBFD]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <FilterToolbar searchPlaceholder="بحث برقم أو اسم المجموعة…" onSearchChange={setSearch}>
        <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
          <Plus className="h-4 w-4" />
          مجموعة
        </Button>
      </FilterToolbar>

      <section className="mb-4 mt-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#0A3D5E]">مجموعات الأصناف</h2>
        <AppTable<GroupLine>
          isLoading={loadingDetail}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle="لا توجد مجموعات"
          emptyDescription="أضف مجموعة أصناف وحدد أيام الآجل."
          virtualizeThreshold={10_000}
          columns={[
            {
              id: 'n',
              header: 'م',
              align: 'center',
              className: cellCls,
              cell: (row) => visible.indexOf(row) + 1,
            },
            {
              id: 'number',
              header: 'رقم المجموعة',
              className: `${cellCls} min-w-[110px]`,
              cell: (row) => row.groupNumber || '—',
            },
            {
              id: 'group',
              header: 'المجموعة',
              className: `${cellCls} min-w-[220px]`,
              cell: (row) => (
                <select
                  className={compactControlClass}
                  value={row.categoryId}
                  onChange={(e) => applyCategory(row.key, e.target.value)}
                >
                  <option value="">اختر المجموعة</option>
                  {itemGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code ? `${g.code} — ` : ''}
                      {g.arabicName}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: 'days',
              header: 'الأيام',
              className: `${cellCls} min-w-[120px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.days}
                  onChange={(e) => patchGroup(row.key, { days: e.target.value })}
                />
              ),
            },
            {
              id: 'remove',
              header: '',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() =>
                    setGroups((prev) =>
                      prev.length > 1 ? prev.filter((t) => t.key !== row.key) : [emptyGroup()]
                    )
                  }
                  aria-label="حذف المجموعة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
            },
          ]}
        />
      </section>

    </MasterCardShell>
  );
}
