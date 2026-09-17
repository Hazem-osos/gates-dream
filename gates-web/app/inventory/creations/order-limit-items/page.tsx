'use client';

import { useMemo, useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  AppTable,
  FilterToolbar,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { ItemSelect } from '@/components/form/ItemSelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import {
  OrderLimitListsSection,
  type OrderLimitListRow,
} from '@/components/inventory/OrderLimitListsSection';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type FormState = {
  code: string;
  warehouseId: string;
  description: string;
};

type LimitLine = {
  key: string;
  id?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  orderLimit: string;
  [key: string]: unknown;
};

type ApiLine = {
  id: string;
  itemId: string;
  orderLimit?: number | string | null;
  item?: {
    id?: string;
    code?: string | null;
    serial?: string | null;
    arabicName?: string;
    orderLimit?: number | string | null;
  };
};

type ApiDetail = OrderLimitListRow & { lines?: ApiLine[] };

const emptyForm = (): FormState => ({ code: '', warehouseId: '', description: '' });

const emptyLine = (): LimitLine => ({
  key: crypto.randomUUID(),
  itemId: '',
  itemCode: '',
  itemName: '',
  orderLimit: '',
});

const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function asText(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function lineFromApi(row: ApiLine): LimitLine {
  return {
    key: row.id,
    id: row.id,
    itemId: row.itemId || row.item?.id || '',
    itemCode: row.item?.code || row.item?.serial || '',
    itemName: row.item?.arabicName || '',
    orderLimit: asText(row.orderLimit ?? row.item?.orderLimit),
  };
}

export default function OrderLimitItemsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<LimitLine[]>([emptyLine(), emptyLine(), emptyLine()]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));
  const patchLine = (key: string, next: Partial<LimitLine>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const hydrate = (detail: ApiDetail) => {
    setSelectedId(detail.id);
    setForm({
      code: detail.code ?? '',
      warehouseId: detail.warehouseId ?? '',
      description: detail.description ?? '',
    });
    const next = (detail.lines ?? []).map(lineFromApi);
    setLines(next.length ? next : [emptyLine(), emptyLine(), emptyLine()]);
  };

  const loadList = async (id: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await apiClient.get<ApiDetail>(`/inventory/item-order-limits/${id}`);
      if (res.data) hydrate(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البطاقة');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setLines([emptyLine(), emptyLine(), emptyLine()]);
    setError('');
    setSuccess('');
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const visible = useMemo(() => {
    if (!search.trim()) return lines;
    const q = search.trim();
    return lines.filter((row) => `${row.itemCode} ${row.itemName}`.includes(q));
  }, [lines, search]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.warehouseId) {
      setError('يرجى اختيار المخزن');
      return;
    }
    const payload = {
      code: form.code || null,
      warehouseId: form.warehouseId,
      description: form.description || null,
      lines: lines
        .filter((row) => row.itemId)
        .map((row) => ({
          itemId: row.itemId,
          orderLimit: num(row.orderLimit) ?? 0,
        })),
    };
    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put<ApiDetail>(`/inventory/item-order-limits/${selectedId}`, payload);
      } else {
        await apiClient.post<ApiDetail>('/inventory/item-order-limits', payload);
      }
      invalidateQuery(['item-order-limits']);
      handleNew();
      setSuccess('تم حفظ حد الطلب — تقدر تضيف التالي');
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
      await apiClient.delete(`/inventory/item-order-limits/${selectedId}`);
      handleNew();
      setSuccess('تم حذف البطاقة');
      invalidateQuery(['item-order-limits']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <MasterCardShell
      title="حد الطلب للأصناف"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'حد الطلب للأصناف' },
      ]}
      docNumber={form.code || 'جديد'}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={handleNew}
      onDelete={selectedId ? () => void handleDelete() : undefined}
      currentId={selectedId}
      favoriteHref="/inventory/creations/order-limit-items"
      moreMenuItems={[{ id: 'add-item', label: 'إضافة صنف', onClick: addLine }]}
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <OrderLimitListsSection onSelect={(row) => void loadList(row.id)} selectedId={selectedId} />

      <FormSectionCard title="بيانات الحد" subtitle="الكود والمخزن والوصف" icon={Package}>
        <CompactFormField label="الكود" value={form.code} onChange={(e) => patch({ code: e.target.value })} />
        <CompactFormField label="المخزن" required>
          <WarehouseSelect
            value={form.warehouseId}
            onChange={(warehouseId) => patch({ warehouseId })}
            emptyLabel="اختر المخزن"
          />
        </CompactFormField>
        <CompactFormField label="الوصف">
          <textarea
            className={`${compactControlClass} min-h-[72px]`}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </CompactFormField>
      </FormSectionCard>

      <FilterToolbar searchPlaceholder="بحث بكود أو اسم الصنف…" onSearchChange={setSearch}>
        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4" />
          صنف
        </Button>
      </FilterToolbar>

      <section className="mb-4 mt-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<LimitLine>
          isLoading={loadingDetail}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle="لا توجد أصناف"
          emptyDescription="أضف صنفاً وحدد حد الطلب ثم احفظ."
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
              id: 'code',
              header: 'كود الصنف',
              className: `${cellCls} min-w-[110px]`,
              cell: (row) => row.itemCode || '—',
            },
            {
              id: 'item',
              header: 'اسم الصنف',
              className: `${cellCls} min-w-[240px]`,
              cell: (row) => (
                <ItemSelect
                  value={row.itemId}
                  emptyLabel="اختر الصنف"
                  menuPlacement="bottom"
                  onChange={(itemId) => patchLine(row.key, { itemId })}
                  onItemResolved={(item) => {
                    const picked = item as ItemOption | undefined;
                    patchLine(row.key, {
                      itemId: picked?.id ?? row.itemId,
                      itemCode: picked?.code || picked?.serial || '',
                      itemName: picked?.arabicName || '',
                      orderLimit:
                        row.orderLimit ||
                        asText((picked as ItemOption & { orderLimit?: number | string })?.orderLimit),
                    });
                  }}
                />
              ),
            },
            {
              id: 'limit',
              header: 'حد الطلب',
              className: `${cellCls} min-w-[140px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.orderLimit}
                  onChange={(e) => patchLine(row.key, { orderLimit: e.target.value })}
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
                    setLines((prev) =>
                      prev.length > 1 ? prev.filter((t) => t.key !== row.key) : [emptyLine()]
                    )
                  }
                  aria-label="حذف السطر"
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
