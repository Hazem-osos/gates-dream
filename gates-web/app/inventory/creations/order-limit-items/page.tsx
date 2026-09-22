'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { CompactFormField, FormSectionCard, AppTable, FilterToolbar, compactControlClass } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { OrderLimitListRow } from '@/components/inventory/OrderLimitListsSection';

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
  warehouseQty: number;
  orderLimit: string;
  lowerLimit: string;
  upperLimit: string;
  [key: string]: unknown;
};

type CatalogItem = {
  id: string;
  code?: string | null;
  serial?: string | null;
  arabicName?: string;
  orderLimit?: number | string | null;
  lowerLimit?: number | string | null;
  upperLimit?: number | string | null;
};

type QtyRow = {
  itemId?: string;
  quantity?: number | string | null;
  quantityOnHand?: number | string | null;
  item?: { id?: string };
};

type ApiLine = {
  id: string;
  itemId: string;
  orderLimit?: number | string | null;
  item?: CatalogItem;
};

type ApiDetail = OrderLimitListRow & { lines?: ApiLine[] };

const emptyForm = (): FormState => ({ code: '', warehouseId: '', description: '' });

const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function asText(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

function asQty(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function lineWarning(row: LimitLine): { tone: 'min' | 'reorder' | 'max'; text: string } | null {
  const qty = row.warehouseQty;
  const lower = num(row.lowerLimit);
  const order = num(row.orderLimit);
  const upper = num(row.upperLimit);
  if (lower != null && qty <= lower) {
    return {
      tone: 'min',
      text: `رصيد المخزن ${qty} تحت الحد الأدنى ${lower} — هيظهر تنبيه نقص لهذا الصنف في المخزن.`,
    };
  }
  if (order != null && qty <= order) {
    return {
      tone: 'reorder',
      text: `رصيد المخزن ${qty} عند حد الطلب ${order} أو أقل — هيظهر تنبيه إعادة طلب.`,
    };
  }
  if (upper != null && qty >= upper) {
    return {
      tone: 'max',
      text: `رصيد المخزن ${qty} وصل الحد الأعلى ${upper} — هيظهر تنبيه زيادة مخزون.`,
    };
  }
  return null;
}

export default function OrderLimitItemsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<LimitLine[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const warehouseId = form.warehouseId;
  const hydrateKeyRef = useRef('');
  const { data: itemsRes, isLoading: itemsLoading } = useApiQuery<CatalogItem[]>(
    ['items', 'order-limits'],
    '/inventory/items',
    { limit: 1000, isActive: true },
    { enabled: Boolean(warehouseId), staleTime: 15_000, skipErrorNotify: true }
  );
  const { data: qtyRes, isLoading: qtyLoading } = useApiQuery<QtyRow[]>(
    ['item-quantities', warehouseId],
    warehouseId ? `/inventory/item-quantities/warehouse/${warehouseId}` : '/inventory/item-quantities',
    undefined,
    { enabled: Boolean(warehouseId), staleTime: 10_000, skipErrorNotify: true }
  );
  const { data: listsRes, isLoading: listsLoading } = useApiQuery<OrderLimitListRow[]>(
    ['item-order-limits', warehouseId],
    '/inventory/item-order-limits',
    { limit: 20, isActive: true, warehouseId },
    { enabled: Boolean(warehouseId), staleTime: 10_000, skipErrorNotify: true }
  );

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));
  const patchLine = (key: string, next: Partial<LimitLine>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const items = Array.isArray(itemsRes?.data)
    ? itemsRes.data
    : ((itemsRes?.data as { items?: CatalogItem[] } | undefined)?.items ?? undefined);
  const lists = Array.isArray(listsRes?.data) ? listsRes.data : undefined;
  const existingListId = lists?.find((row) => row.warehouseId === warehouseId)?.id ?? '';
  const itemIdsKey = (items ?? []).map((item) => item.id).join(',');
  const hydrateKey = `${warehouseId}:${itemIdsKey}:${existingListId}`;

  useEffect(() => {
    if (!warehouseId) {
      if (hydrateKeyRef.current === '') return;
      hydrateKeyRef.current = '';
      setSelectedId(null);
      setLines([]);
      return;
    }
    if (itemsLoading || listsLoading || !items) return;
    if (hydrateKeyRef.current === hydrateKey) return;
    hydrateKeyRef.current = hydrateKey;
    const qtyByItem = new Map<string, number>();
    for (const row of qtyRes?.data ?? []) {
      const id = row.itemId || row.item?.id;
      if (!id) continue;
      qtyByItem.set(id, (qtyByItem.get(id) ?? 0) + asQty(row.quantityOnHand ?? row.quantity));
    }
    let cancelled = false;
    const apply = (detail?: ApiDetail) => {
      if (cancelled) return;
      setSelectedId(detail?.id ?? existingListId ?? null);
      if (detail) {
        setForm((prev) => ({
          ...prev,
          code: detail.code ?? prev.code,
          description: detail.description ?? prev.description,
        }));
      }
      const saved = new Map((detail?.lines ?? []).map((line) => [line.itemId, line]));
      setLines(
        items.map((item) => {
          const savedLine = saved.get(item.id);
          return {
            key: item.id,
            id: savedLine?.id,
            itemId: item.id,
            itemCode: item.code || item.serial || '',
            itemName: item.arabicName || '',
            warehouseQty: qtyByItem.get(item.id) ?? 0,
            orderLimit: asText(savedLine?.orderLimit ?? item.orderLimit),
            lowerLimit: asText(savedLine?.item?.lowerLimit ?? item.lowerLimit),
            upperLimit: asText(savedLine?.item?.upperLimit ?? item.upperLimit),
          };
        })
      );
    };
    if (!existingListId) {
      apply();
      return () => {
        cancelled = true;
      };
    }
    void apiClient
      .get<ApiDetail>(`/inventory/item-order-limits/${existingListId}`)
      .then((res) => apply(res.data))
      .catch(() => apply());
    return () => {
      cancelled = true;
    };
  }, [warehouseId, items, itemsLoading, listsLoading, hydrateKey, existingListId, qtyRes?.data]);

  useEffect(() => {
    if (!warehouseId) return;
    const qtyByItem = new Map<string, number>();
    for (const row of qtyRes?.data ?? []) {
      const id = row.itemId || row.item?.id;
      if (!id) continue;
      qtyByItem.set(id, (qtyByItem.get(id) ?? 0) + asQty(row.quantityOnHand ?? row.quantity));
    }
    setLines((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((row) => {
        const qty = qtyByItem.get(row.itemId) ?? 0;
        if (qty === row.warehouseQty) return row;
        changed = true;
        return { ...row, warehouseQty: qty };
      });
      return changed ? next : prev;
    });
  }, [warehouseId, qtyRes?.data]);

  const handleNew = () => {
    hydrateKeyRef.current = '';
    setSelectedId(null);
    setForm(emptyForm());
    setLines([]);
    setError('');
    setSuccess('');
  };

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
      code: form.code.trim() || null,
      warehouseId: form.warehouseId,
      description: form.description.trim() || null,
      lines: lines
        .filter((row) => row.itemId && (row.orderLimit || row.lowerLimit || row.upperLimit))
        .map((row) => ({
          itemId: row.itemId,
          orderLimit: num(row.orderLimit) ?? 0,
          lowerLimit: num(row.lowerLimit),
          upperLimit: num(row.upperLimit),
        })),
    };
    setSaving(true);
    try {
      const targetId = selectedId || existingListId || '';
      const res = targetId
        ? await apiClient.put<ApiDetail>(`/inventory/item-order-limits/${targetId}`, payload)
        : await apiClient.post<ApiDetail>('/inventory/item-order-limits', payload);
      if (res.data?.id) setSelectedId(res.data.id);
      invalidateQuery(['item-order-limits']);
      invalidateQuery(['items']);
      setSuccess('تم حفظ حدود الأصناف — التنبيه هيشتغل حسب رصيد المخزن المختار');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(message && !/^failed to /i.test(message) ? message : 'تعذر حفظ حدود الأصناف. راجع المخزن ثم أعد المحاولة.');
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

  const loading = Boolean(warehouseId) && (itemsLoading || qtyLoading || listsLoading);

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
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <FormSectionCard
        title="بيانات الحد"
        subtitle="اختَر المخزن — الجدول هيحمّل الأصناف ورصيدها في المخزن ده"
        icon={Package}
      >
        <CompactFormField label="الكود" value={form.code} onChange={(e) => patch({ code: e.target.value })} />
        <CompactFormField label="المخزن" required>
          <WarehouseSelect
            value={form.warehouseId}
            onChange={(nextWarehouseId) => {
              setSelectedId(null);
              setForm((prev) => ({ ...prev, warehouseId: nextWarehouseId, code: '', description: '' }));
            }}
            emptyLabel="اختر المخزن"
            enableQuickCreate={false}
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

      <FilterToolbar searchPlaceholder="بحث بكود أو اسم الصنف…" onSearchChange={setSearch} />

      <section className="mb-4 mt-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<LimitLine>
          isLoading={loading}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle={warehouseId ? 'لا توجد أصناف' : 'اختر المخزن أولاً'}
          emptyDescription={
            warehouseId
              ? 'أضف أصنافاً من دليل الأصناف ثم ارجع هنا.'
              : 'بعد اختيار المخزن هنحمّل الأصناف ورصيد كل صنف فيه.'
          }
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
              className: `${cellCls} min-w-[200px]`,
              cell: (row) => row.itemName || '—',
            },
            {
              id: 'qty',
              header: 'رصيد المخزن',
              align: 'center',
              className: `${cellCls} min-w-[110px]`,
              cell: (row) => row.warehouseQty,
            },
            {
              id: 'lower',
              header: 'الحد الأدنى',
              className: `${cellCls} min-w-[120px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.lowerLimit}
                  onChange={(e) => patchLine(row.key, { lowerLimit: e.target.value })}
                />
              ),
            },
            {
              id: 'limit',
              header: 'حد الطلب',
              className: `${cellCls} min-w-[120px]`,
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
              id: 'upper',
              header: 'الحد الأعلى',
              className: `${cellCls} min-w-[120px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.upperLimit}
                  onChange={(e) => patchLine(row.key, { upperLimit: e.target.value })}
                />
              ),
            },
            {
              id: 'warn',
              header: 'تنبيه',
              className: `${cellCls} min-w-[220px]`,
              cell: (row) => {
                const warn = lineWarning(row);
                if (!warn) return <span className="text-xs text-slate-400">—</span>;
                const color =
                  warn.tone === 'min'
                    ? 'text-red-700'
                    : warn.tone === 'max'
                      ? 'text-amber-700'
                      : 'text-[#0E78AA]';
                return <span className={`text-xs font-medium ${color}`}>{warn.text}</span>;
              },
            },
          ]}
        />
      </section>
    </MasterCardShell>
  );
}
