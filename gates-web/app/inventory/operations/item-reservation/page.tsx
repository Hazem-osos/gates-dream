'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useItemStockBalance } from '@/lib/hooks/useItemStockBalance';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { queryKeys } from '@/lib/query/query-keys';

type ReservationStatus = 'ACTIVE' | 'RELEASED';

type ReservationRow = {
  id: string;
  warehouseId: string;
  itemId: string;
  quantity: number;
  fulfilledQuantity?: number;
  remainingQuantity?: number;
  reason: string;
  status: ReservationStatus | string;
  issueStatusLabel?: string;
  createdAt: string;
  warehouseName: string;
  warehouseCode?: string | null;
  itemName: string;
  itemSerial?: string;
};

type FormState = {
  warehouseId: string;
  itemId: string;
  quantity: string;
  reason: string;
};

const emptyForm = (): FormState => ({
  warehouseId: '',
  itemId: '',
  quantity: '',
  reason: '',
});

function asQty(value: string): number | null {
  const n = parseFloat(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
}

function formatQty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ItemReservationPage() {
  const invalidateQuery = useInvalidateQuery();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadedQuantity, setLoadedQuantity] = useState(0);
  const [listStatus, setListStatus] = useState<ReservationStatus>('ACTIVE');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  const stockQuery = useItemStockBalance(form.itemId || null, form.warehouseId || null);
  const available = stockQuery.data?.data?.availableQuantity ?? 0;
  const ceiling = Math.round((available + (editingId ? loadedQuantity : 0)) * 10000) / 10000;

  const listParams = useMemo(
    () => ({
      warehouseId: form.warehouseId,
      status: listStatus === 'ACTIVE' ? 'OPEN' : listStatus,
      limit: 100,
    }),
    [form.warehouseId, listStatus]
  );
  const listQuery = useApiQuery<ReservationRow[]>(
    queryKeys.itemReservations(listParams),
    '/inventory/item-reservations',
    listParams,
    { enabled: Boolean(form.warehouseId), staleTime: 10_000, skipErrorNotify: true }
  );
  const rows = Array.isArray(listQuery.data?.data) ? listQuery.data.data : [];

  const resetHold = () => {
    setEditingId(null);
    setLoadedQuantity(0);
    setForm((prev) => ({ ...prev, itemId: '', quantity: '', reason: '' }));
  };

  const refresh = () => {
    invalidateStockViews(invalidateQuery);
    invalidateQuery(queryKeys.itemReservations());
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.warehouseId) {
      setError('يرجى اختيار المخزن');
      return;
    }
    if (!form.itemId) {
      setError('يرجى اختيار الصنف');
      return;
    }
    const quantity = asQty(form.quantity);
    if (quantity == null || quantity <= 0) {
      setError('الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    if (quantity > ceiling + 1e-9) {
      setError(`الكمية المتاحة لا تكفي للحجز. المتاح: ${formatQty(ceiling)}`);
      return;
    }
    if (!form.reason.trim()) {
      setError('سبب الحجز مطلوب');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.put(`/inventory/item-reservations/${editingId}`, {
          quantity,
          reason: form.reason.trim(),
        });
        setSuccess('تم تعديل الحجز');
        setLoadedQuantity(quantity);
      } else {
        await apiClient.post('/inventory/item-reservations', {
          warehouseId: form.warehouseId,
          itemId: form.itemId,
          quantity,
          reason: form.reason.trim(),
        });
        setSuccess('تم حجز الكمية');
        setForm((prev) => ({ ...prev, quantity: '', reason: '' }));
      }
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(message && !/^failed to /i.test(message) ? message : 'تعذر حفظ الحجز');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (id: string) => {
    if (!window.confirm('إلغاء الحجز وإرجاع الكمية للكمية المتاحة؟')) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiClient.post(`/inventory/item-reservations/${id}/release`);
      if (editingId === id) resetHold();
      setSuccess('تم إلغاء الحجز');
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(message && !/^failed to /i.test(message) ? message : 'تعذر إلغاء الحجز');
    } finally {
      setSaving(false);
    }
  };

  const openRow = (row: ReservationRow) => {
    if (row.status !== 'ACTIVE') return;
    setEditingId(row.id);
    setLoadedQuantity(row.quantity);
    setForm({
      warehouseId: row.warehouseId,
      itemId: row.itemId,
      quantity: String(row.quantity),
      reason: row.reason,
    });
    setError('');
  };

  return (
    <MasterCardShell
      title="حجز الأصناف"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'عمليات المخازن' },
        { label: 'حجز الأصناف' },
      ]}
      statusLabel={editingId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={() => {
        setForm(emptyForm());
        setEditingId(null);
        setLoadedQuantity(0);
        setError('');
      }}
      favoriteHref="/inventory/operations/item-reservation"
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <FormSectionCard
        title="بيانات الحجز"
        subtitle="الكمية المحجوزة تظهر في جرد الأصناف في عمود المحجوز، والمتاح ينقص بنفس الكمية"
        icon={Lock}
        bodyClassName="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <CompactFormField label="اسم المخزن" required>
          <WarehouseSelect
            value={form.warehouseId}
            onChange={(warehouseId) => {
              setEditingId(null);
              setLoadedQuantity(0);
              setForm((prev) => ({ ...prev, warehouseId, itemId: '', quantity: '', reason: '' }));
            }}
            emptyLabel="اختر المخزن"
            enableQuickCreate={false}
            disabled={Boolean(editingId)}
          />
        </CompactFormField>
        <CompactFormField label="اسم الصنف" required>
          <ItemSelect
            value={form.itemId}
            onChange={(itemId) => {
              if (!editingId) patch({ itemId });
            }}
            emptyLabel="اختر الصنف"
            enableQuickCreate={false}
            disabled={Boolean(editingId) || !form.warehouseId}
            warehouseId={form.warehouseId || undefined}
            fallbackLabel={rows.find((row) => row.id === editingId)?.itemName}
          />
        </CompactFormField>
        <CompactFormField label="الكمية المتاحة">
          <input
            className={compactControlClass}
            readOnly
            value={
              form.itemId && form.warehouseId
                ? stockQuery.isLoading
                  ? '...'
                  : formatQty(available)
                : ''
            }
            placeholder="تظهر بعد اختيار المخزن والصنف"
          />
        </CompactFormField>
        <CompactFormField
          label="الكمية المحجوزة"
          required
          hint={
            form.itemId && form.warehouseId
              ? editingId
                ? `تقدر تعدّل الكمية لحد ${formatQty(ceiling)}`
                : `الحد الأقصى للحجز ${formatQty(available)}`
              : undefined
          }
        >
          <input
            className={compactControlClass}
            inputMode="decimal"
            value={form.quantity}
            onChange={(e) => patch({ quantity: e.target.value })}
            placeholder="0"
          />
        </CompactFormField>
        <CompactFormField className="sm:col-span-2" label="سبب الحجز" required>
          <input
            className={compactControlClass}
            value={form.reason}
            maxLength={500}
            onChange={(e) => patch({ reason: e.target.value })}
            placeholder="سبب حجز الكمية"
          />
        </CompactFormField>
      </FormSectionCard>

      <div className="mb-3 mt-4 flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${listStatus === 'ACTIVE' ? 'bg-brand text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          onClick={() => setListStatus('ACTIVE')}
        >
          المحجوز الحالي
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${listStatus === 'RELEASED' ? 'bg-brand text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          onClick={() => setListStatus('RELEASED')}
        >
          الحجوزات الملغاة
        </button>
        {editingId && listStatus === 'ACTIVE' ? (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-red-700 ring-1 ring-red-200"
            disabled={saving}
            onClick={() => void handleRelease(editingId)}
          >
            إلغاء الحجز
          </button>
        ) : null}
      </div>

      <section className="mb-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<ReservationRow>
          isLoading={Boolean(form.warehouseId) && listQuery.isLoading}
          data={rows}
          getRowKey={(row) => row.id}
          onRowClick={openRow}
          emptyTitle={form.warehouseId ? 'لا توجد حجوزات' : 'اختر المخزن أولاً'}
          emptyDescription={
            form.warehouseId
              ? 'احجز كمية من صنف، وهتظهر هنا وفي عمود المحجوز بجرد الأصناف.'
              : 'بعد اختيار المخزن تقدر تختار الصنف وسبب الحجز.'
          }
          columns={[
            {
              id: 'item',
              header: 'الصنف',
              cell: (row) => row.itemSerial ? `${row.itemSerial} — ${row.itemName}` : row.itemName,
            },
            {
              id: 'warehouse',
              header: 'المخزن',
              cell: (row) => row.warehouseName,
            },
            {
              id: 'qty',
              header: 'محجوز / متبقي',
              align: 'center',
              cell: (row) =>
                `${formatQty(row.quantity)} / ${formatQty(row.remainingQuantity ?? row.quantity)}`,
            },
            {
              id: 'issue',
              header: 'حالة الصرف',
              cell: (row) => row.issueStatusLabel ?? '—',
            },
            {
              id: 'reason',
              header: 'سبب الحجز',
              cell: (row) => row.reason,
            },
            {
              id: 'when',
              header: 'التاريخ',
              cell: (row) => formatWhen(row.createdAt),
            },
            {
              id: 'action',
              header: '',
              cell: (row) =>
                row.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRelease(row.id);
                    }}
                  >
                    إلغاء
                  </button>
                ) : (
                  'ملغى'
                ),
            },
          ]}
        />
      </section>
    </MasterCardShell>
  );
}
