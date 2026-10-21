'use client';

import { useCallback, useMemo, useState } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CustomerSelect } from '@/app/components/form/PartySelect';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useItemStockBalance } from '@/lib/hooks/useItemStockBalance';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { queryKeys } from '@/lib/query/query-keys';
import { printStockDocument } from '@/lib/print/printStockDocument';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';

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

type HeaderState = {
  warehouseId: string;
  customerId: string;
};

type DraftLine = {
  key: string;
  itemId: string;
  quantity: string;
  reason: string;
};

type EditFormState = HeaderState & {
  itemId: string;
  quantity: string;
  reason: string;
};

const emptyHeader = (): HeaderState => ({
  warehouseId: '',
  customerId: '',
});

const newDraftLine = (): DraftLine => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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

function AvailableQtyCell({
  warehouseId,
  itemId,
}: {
  warehouseId: string;
  itemId: string;
}) {
  const stockQuery = useItemStockBalance(itemId || null, warehouseId || null);
  const available = stockQuery.data?.data?.availableQuantity ?? 0;
  if (!itemId || !warehouseId) return <span className="text-slate-400">—</span>;
  if (stockQuery.isLoading) return <span className="text-slate-400">...</span>;
  return <span>{formatQty(available)}</span>;
}

export default function ItemReservationPage() {
  const invalidateQuery = useInvalidateQuery();
  const [header, setHeader] = useState<HeaderState>(emptyHeader);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([newDraftLine()]);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<ReservationStatus>('ACTIVE');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  type ItemReservationDraft = { header: HeaderState; draftLines: DraftLine[] };

  const isItemReservationDraftEmpty = (draft: ItemReservationDraft) =>
    !draft.header.customerId?.trim() &&
    !draft.header.warehouseId?.trim() &&
    !draft.draftLines.some((line) => line.itemId?.trim() || line.reason?.trim());

  const draftSnapshot = useMemo(
    (): ItemReservationDraft => ({ header, draftLines }),
    [draftLines, header]
  );

  const applyItemReservationDraft = useCallback((payload: ItemReservationDraft) => {
    setHeader(payload.header ?? emptyHeader());
    setDraftLines(
      Array.isArray(payload.draftLines) && payload.draftLines.length
        ? payload.draftLines
        : [newDraftLine()]
    );
    setEditingId(null);
    setEditForm(null);
  }, []);

  const { restoreOffer, acceptRestore, dismissRestore, clearDraft } = useDraftAutosave({
    documentType: 'item-reservation',
    value: draftSnapshot,
    enabled: !editingId,
    applyRestore: applyItemReservationDraft,
    isEmpty: isItemReservationDraftEmpty,
    restoreMessage: 'يوجد مسودة حجز أصناف غير محفوظة',
  });

  const patchHeader = (next: Partial<HeaderState>) => setHeader((prev) => ({ ...prev, ...next }));

  const editStockQuery = useItemStockBalance(
    editForm?.itemId || null,
    editForm?.warehouseId || null
  );
  const editAvailable = editStockQuery.data?.data?.availableQuantity ?? 0;

  const listParams = useMemo(
    () => ({
      warehouseId: header.warehouseId,
      status: listStatus === 'ACTIVE' ? 'OPEN' : listStatus,
      limit: 100,
    }),
    [header.warehouseId, listStatus]
  );
  const listQuery = useApiQuery<ReservationRow[]>(
    queryKeys.itemReservations(listParams),
    '/inventory/item-reservations',
    listParams,
    { enabled: Boolean(header.warehouseId), staleTime: 10_000, skipErrorNotify: true }
  );
  const rows = Array.isArray(listQuery.data?.data) ? listQuery.data.data : [];

  const resetNew = () => {
    clearDraft();
    setEditingId(null);
    setEditForm(null);
    setHeader(emptyHeader());
    setDraftLines([newDraftLine()]);
  };

  const refresh = () => {
    invalidateStockViews(invalidateQuery);
    invalidateQuery(queryKeys.itemReservations());
  };

  const updateDraftLine = (key: string, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (editingId && editForm) {
      if (!editForm.reason.trim()) {
        setError('سبب الحجز مطلوب');
        return;
      }
      const quantity = asQty(editForm.quantity);
      if (quantity == null || quantity <= 0) {
        setError('الكمية يجب أن تكون أكبر من صفر');
        return;
      }
      setSaving(true);
      try {
        await apiClient.put(`/inventory/item-reservations/${editingId}`, {
          quantity,
          reason: editForm.reason.trim(),
        });
        setSuccess('تم تعديل الحجز');
        refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        setError(message && !/^failed to /i.test(message) ? message : 'تعذر حفظ الحجز');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!header.warehouseId) {
      setError('يرجى اختيار المخزن');
      return;
    }
    if (!header.customerId) {
      setError('يرجى اختيار العميل');
      return;
    }

    const toSave = draftLines
      .map((line) => ({
        ...line,
        quantityNum: asQty(line.quantity),
      }))
      .filter((line) => line.itemId && line.quantityNum != null && line.quantityNum > 0);

    if (toSave.length === 0) {
      setError('أضف صنفاً واحداً على الأقل مع كمية أكبر من صفر');
      return;
    }

    for (const line of toSave) {
      if (!line.reason.trim()) {
        setError('سبب الحجز مطلوب لكل صنف');
        return;
      }
    }

    setSaving(true);
    try {
      for (const line of toSave) {
        await apiClient.post('/inventory/item-reservations', {
          warehouseId: header.warehouseId,
          customerId: header.customerId,
          itemId: line.itemId,
          quantity: line.quantityNum,
          reason: line.reason.trim(),
        });
      }
      setSuccess(toSave.length === 1 ? 'تم حجز الكمية' : `تم حجز ${toSave.length} أصناف`);
      clearDraft();
      setDraftLines([newDraftLine()]);
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
      if (editingId === id) resetNew();
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
    setEditForm({
      warehouseId: row.warehouseId,
      customerId: (row as { customerId?: string }).customerId ?? '',
      itemId: row.itemId,
      quantity: String(row.quantity),
      reason: row.reason,
    });
    setError('');
  };

  const isEditing = Boolean(editingId && editForm);

  const printReady =
    rows.length > 0 ||
    draftLines.some((line) => line.itemId && asQty(line.quantity) != null) ||
    isEditing;

  const handlePrint = () => {
    if (isEditing && editForm) {
      const row = rows.find((r) => r.id === editingId);
      printStockDocument({
        title: 'حجز الأصناف',
        date: new Date().toISOString().slice(0, 10),
        rows: [
          {
            item: row?.itemName || editForm.itemId,
            quantity: asQty(editForm.quantity) ?? 0,
          },
        ],
      });
      return;
    }
    const draftRows = draftLines
      .filter((line) => line.itemId && asQty(line.quantity) != null)
      .map((line) => ({
        item: line.itemId,
        quantity: asQty(line.quantity) ?? 0,
      }));
    if (draftRows.length > 0) {
      printStockDocument({
        title: 'حجز الأصناف',
        date: new Date().toISOString().slice(0, 10),
        rows: draftRows,
      });
      return;
    }
    printStockDocument({
      title: 'حجز الأصناف',
      date: new Date().toISOString().slice(0, 10),
      rows: rows.map((row) => ({
        item: row.itemName,
        quantity: row.quantity,
      })),
    });
  };

  return (
    <MasterCardShell
      title="حجز الأصناف"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'عمليات المخازن' },
        { label: 'حجز الأصناف' },
      ]}
      statusLabel={isEditing ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={resetNew}
      onPrint={printReady ? handlePrint : undefined}
      printDocumentReady={printReady}
      favoriteHref="/inventory/operations/item-reservation"
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageDraftRestoreGate<ItemReservationDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(editingId)}
        message="يوجد مسودة حجز أصناف غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyItemReservationDraft(payload);
          setSuccess('تم استعادة مسودة الحجز');
        }}
      />

      {isEditing && editForm ? (
        <FormSectionCard
          title="تعديل الحجز"
          subtitle="يمكن تعديل الكمية وسبب الحجز للحجز المحدد"
          icon={Lock}
          bodyClassName="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <CompactFormField label="اسم المخزن">
            <WarehouseSelect value={editForm.warehouseId} onChange={() => {}} disabled emptyLabel="—" />
          </CompactFormField>
          <CompactFormField label="العميل">
            <CustomerSelect value={editForm.customerId} onChange={() => {}} disabled emptyLabel="—" />
          </CompactFormField>
          <CompactFormField label="اسم الصنف">
            <ItemSelect
              value={editForm.itemId}
              onChange={() => {}}
              disabled
              emptyLabel="—"
              enableQuickCreate={false}
              warehouseId={editForm.warehouseId}
              fallbackLabel={rows.find((row) => row.id === editingId)?.itemName}
            />
          </CompactFormField>
          <CompactFormField label="الكمية المتاحة">
            <input
              className={compactControlClass}
              readOnly
              value={editStockQuery.isLoading ? '...' : formatQty(editAvailable)}
            />
          </CompactFormField>
          <CompactFormField label="الكمية المحجوزة" required>
            <input
              className={compactControlClass}
              inputMode="decimal"
              value={editForm.quantity}
              onChange={(e) => setEditForm((prev) => prev && { ...prev, quantity: e.target.value })}
            />
          </CompactFormField>
          <CompactFormField className="sm:col-span-2" label="سبب الحجز" required>
            <input
              className={compactControlClass}
              value={editForm.reason}
              maxLength={500}
              onChange={(e) => setEditForm((prev) => prev && { ...prev, reason: e.target.value })}
            />
          </CompactFormField>
        </FormSectionCard>
      ) : (
        <FormSectionCard
          title="بيانات الحجز"
          subtitle="يمكنك حجز أكثر من صنف في نفس العملية — أضف أسطراً ثم احفظ مرة واحدة"
          icon={Lock}
          bodyClassName="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField label="اسم المخزن" required>
              <WarehouseSelect
                value={header.warehouseId}
                onChange={(warehouseId) => {
                  setHeader({ warehouseId, customerId: header.customerId });
                  setDraftLines([newDraftLine()]);
                }}
                emptyLabel="اختر المخزن"
                enableQuickCreate={false}
              />
            </CompactFormField>
            <CompactFormField label="العميل" required>
              <CustomerSelect
                value={header.customerId}
                onChange={(customerId) => patchHeader({ customerId })}
                emptyLabel="اختر العميل"
              />
            </CompactFormField>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">الأصناف المحجوزة</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-brand ring-1 ring-brand/30 hover:bg-brand/5"
              disabled={!header.warehouseId}
              onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])}
            >
              <Plus className="h-4 w-4" />
              إضافة صنف
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-start font-medium">الصنف</th>
                  <th className="w-24 px-2 py-2 text-center font-medium">المتاح</th>
                  <th className="w-28 px-2 py-2 text-center font-medium">الكمية</th>
                  <th className="min-w-[12rem] px-2 py-2 text-start font-medium">سبب الحجز</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {draftLines.map((line) => (
                  <tr key={line.key} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <ItemSelect
                        value={line.itemId}
                        onChange={(itemId) => updateDraftLine(line.key, { itemId })}
                        emptyLabel="اختر الصنف"
                        enableQuickCreate={false}
                        disabled={!header.warehouseId}
                        warehouseId={header.warehouseId || undefined}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <AvailableQtyCell warehouseId={header.warehouseId} itemId={line.itemId} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={compactControlClass}
                        inputMode="decimal"
                        value={line.quantity}
                        placeholder="0"
                        onChange={(e) => updateDraftLine(line.key, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={compactControlClass}
                        value={line.reason}
                        maxLength={500}
                        placeholder="سبب الحجز"
                        onChange={(e) => updateDraftLine(line.key, { reason: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        disabled={draftLines.length <= 1}
                        title="حذف السطر"
                        onClick={() =>
                          setDraftLines((prev) => prev.filter((row) => row.key !== line.key))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSectionCard>
      )}

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
        {isEditing ? (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-red-700 ring-1 ring-red-200"
            disabled={saving}
            onClick={() => void handleRelease(editingId!)}
          >
            إلغاء الحجز
          </button>
        ) : null}
      </div>

      <section className="mb-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<ReservationRow>
          isLoading={Boolean(header.warehouseId) && listQuery.isLoading}
          data={rows}
          getRowKey={(row) => row.id}
          onRowClick={openRow}
          emptyTitle={header.warehouseId ? 'لا توجد حجوزات' : 'اختر المخزن أولاً'}
          emptyDescription={
            header.warehouseId
              ? 'احجز كميات من الأصناف، وهتظهر هنا وفي عمود المحجوز بجرد الأصناف.'
              : 'بعد اختيار المخزن أضف الأصناف والكميات ثم احفظ.'
          }
          columns={[
            {
              id: 'item',
              header: 'الصنف',
              cell: (row) => (row.itemSerial ? `${row.itemSerial} — ${row.itemName}` : row.itemName),
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
