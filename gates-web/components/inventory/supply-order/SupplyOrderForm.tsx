'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ErpDocumentLayout, ErpDocumentPageHeader, DocumentBrowseDrawer, ErpFormHeaderCard, erpInputClass, erpLabelClass } from '@/components/erp';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { CustomerSelect } from '@/app/components/form/PartySelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import {
  Button,
  denseTableClass,
  denseTableWrapClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
  FormStickyFooter,
} from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { confirmAction } from '@/lib/feedback/confirm';
import type { ApiError } from '@/lib/api/types';

export type SupplyOrderLineForm = {
  itemId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: number;
};

type SupplyOrderRecord = {
  id: string;
  serial?: string | null;
  description?: string | null;
  date?: string;
  hijriDate?: string | null;
  customerId?: string;
  expectedLeadDays?: number | null;
  expectedDeliveryDate?: string | null;
  isClosed?: boolean;
  isCancelled?: boolean;
  totalAmount?: number | string;
  customer?: { arabicName?: string };
  lines?: Array<{
    itemId: string;
    warehouseId: string;
    quantity?: number | string;
    unitPrice?: number | string;
    item?: { serial?: string; arabicName?: string };
  }>;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function addDaysIso(base: string, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function emptyLine(): SupplyOrderLineForm {
  return { itemId: '', warehouseId: '', quantity: 1, unitPrice: 0 };
}

function statusLabel(row: SupplyOrderRecord | null) {
  if (row?.isCancelled) return { tone: 'danger' as const, label: 'ملغي' };
  if (row?.isClosed) return { tone: 'success' as const, label: 'مغلق' };
  return { tone: 'warning' as const, label: 'مفتوح' };
}

export function SupplyOrderForm() {
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [customerId, setCustomerId] = useState('');
  const [expectedLeadDays, setExpectedLeadDays] = useState(7);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(addDaysIso(todayIso(), 7));
  const [lines, setLines] = useState<SupplyOrderLineForm[]>([emptyLine()]);

  const { data: loadedRes } = useApiQuery<SupplyOrderRecord>(
    ['supply-order', selectedId],
    selectedId ? `/inventory/supply-orders/${selectedId}` : '/inventory/supply-orders',
    undefined,
    { enabled: Boolean(selectedId) }
  );
  const loaded = loadedRes?.data ?? null;
  const status = statusLabel(loaded);
  const readOnly = Boolean(loaded?.isClosed || loaded?.isCancelled);

  useEffect(() => {
    const id = searchParams.get('id')?.trim();
    if (id && id !== selectedId) setSelectedId(id);
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!loaded || !selectedId) return;
    setSerial(loaded.serial || '');
    setDescription(loaded.description || '');
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    setCustomerId(loaded.customerId || '');
    setExpectedLeadDays(Number(loaded.expectedLeadDays ?? 7));
    setExpectedDeliveryDate(
      loaded.expectedDeliveryDate
        ? String(loaded.expectedDeliveryDate).slice(0, 10)
        : addDaysIso(date, Number(loaded.expectedLeadDays ?? 7))
    );
    setLines(
      (loaded.lines ?? []).map((l) => ({
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      }))
    );
  }, [loaded, selectedId, date]);

  useEffect(() => {
    if (!date || expectedLeadDays < 0) return;
    setExpectedDeliveryDate(addDaysIso(date, expectedLeadDays));
  }, [date, expectedLeadDays]);

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines]
  );

  const buildBody = useCallback(() => {
    const filled = lines.filter((l) => l.itemId && l.warehouseId && Number(l.quantity) > 0);
    if (!customerId) throw new Error('اختر العميل');
    if (filled.length === 0) throw new Error('أدخل صنفاً واحداً على الأقل');
    return {
      serial: serial.trim() || undefined,
      description: description.trim() || undefined,
      date,
      customerId,
      expectedLeadDays,
      expectedDeliveryDate,
      lines: filled.map((l) => ({
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
      })),
    };
  }, [lines, customerId, serial, description, date, expectedLeadDays, expectedDeliveryDate]);

  const openDoc = (id: string | null) => {
    setSelectedId(id);
    if (typeof window === 'undefined') return;
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };

  const resetNew = () => {
    setSelectedId(null);
    setSerial('');
    setDescription('');
    setDate(todayIso());
    setCustomerId('');
    setExpectedLeadDays(7);
    setExpectedDeliveryDate(addDaysIso(todayIso(), 7));
    setLines([emptyLine()]);
    setError('');
    openDoc(null);
  };

  const createMutation = useApiMutation<SupplyOrderRecord, Record<string, unknown>>(
    '/inventory/supply-orders',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const id = res.data?.id;
        finishDocumentSave({
          label: 'أمر توريد',
          number: res.data?.serial,
          savedId: id,
          cleared: false,
          onOpen: openDoc,
          onSavedOpen: (saved) => invalidateQuery(['supply-order', saved]),
          reset: () => {
            if (id) openDoc(id);
          },
        });
      },
      onError: (e: ApiError) => setError(e.message || 'تعذر الحفظ'),
    }
  );

  const updateMutation = useApiMutation<SupplyOrderRecord, Record<string, unknown>>(
    selectedId ? `/inventory/supply-orders/${selectedId}` : '/inventory/supply-orders',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        setSuccess('تم تحديث أمر التوريد');
        invalidateQuery(['supply-order', selectedId]);
        if (res.data?.serial) setSerial(res.data.serial);
      },
      onError: (e: ApiError) => setError(e.message || 'تعذر التحديث'),
    }
  );

  const handleSave = () => {
    setError('');
    try {
      const body = buildBody();
      if (selectedId) updateMutation.mutate(body);
      else createMutation.mutate(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تحقق من البيانات');
    }
  };

  const lifecycle = async (action: 'close' | 'reopen' | 'cancel' | 'restore') => {
    if (!selectedId) return;
    const paths = {
      close: 'close',
      reopen: 'reopen',
      cancel: 'cancel',
      restore: 'restore',
    };
    if (action === 'cancel' && !(await confirmAction('إلغاء أمر التوريد؟'))) return;
    try {
      await apiClient.post(`/inventory/supply-orders/${selectedId}/${paths[action]}`);
      invalidateQuery(['supply-order', selectedId]);
      setSuccess('تم تحديث حالة الأمر');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تنفيذ العملية');
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'المبيعات' },
          { label: 'أمر توريد' },
        ]}
        title="أمر توريد"
        docNumber={serial || '—'}
        statusTone={status.tone}
        statusLabel={status.label}
        saveLabel="حفظ أمر التوريد"
        onSaveDraft={handleSave}
        savePending={saving}
        canSave={!readOnly && !saving}
        onBrowseList={() => setBrowseOpen(true)}
        browseListLabel="السابق"
        currentId={selectedId}
        favoriteHref="/inventory/operations/supply-order"
        standardActions={{
          hasDocument: Boolean(selectedId),
          isPosted: Boolean(loaded?.isClosed),
          onNew: resetNew,
          newLabel: 'جديد',
          extraItems: selectedId
            ? [
                ...(loaded?.isCancelled
                  ? [{ id: 'restore', label: 'استعادة', onClick: () => void lifecycle('restore') }]
                  : [
                      {
                        id: 'toggle-close',
                        label: loaded?.isClosed ? 'فتح الأمر' : 'إغلاق الأمر',
                        onClick: () => void lifecycle(loaded?.isClosed ? 'reopen' : 'close'),
                      },
                      {
                        id: 'cancel',
                        label: 'إلغاء',
                        onClick: () => void lifecycle('cancel'),
                        disabled: loaded?.isClosed,
                      },
                    ]),
              ]
            : [],
        }}
      />

      <ErpFormHeaderCard
        row1={
          <>
            <div className="space-y-1">
              <label className={erpLabelClass}>المسلسل</label>
              <input
                className={erpInputClass}
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="يُولَّد تلقائياً عند الحفظ"
                disabled={readOnly}
              />
            </div>
            <DatePickerWithHijri label="تاريخ أمر التوريد" value={date} onChange={setDate} disabled={readOnly} />
            <div className="space-y-1">
              <label className={erpLabelClass}>المدة المتوقعة للتسليم (يوم)</label>
              <input
                type="number"
                min={0}
                className={erpInputClass}
                value={expectedLeadDays}
                onChange={(e) => setExpectedLeadDays(Number(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>
            <DatePickerWithHijri
              label="تاريخ التسليم المتوقع"
              value={expectedDeliveryDate}
              onChange={setExpectedDeliveryDate}
              disabled={readOnly}
            />
          </>
        }
        row2={
          <>
            <div className="space-y-1">
              <label className={erpLabelClass}>العميل</label>
              <CustomerSelect value={customerId} onChange={setCustomerId} className={erpInputClass} disabled={readOnly} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={erpLabelClass}>الشرح</label>
              <input
                className={erpInputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </>
        }
      />

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">
        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                <th className={denseThClass}>الصنف</th>
                <th className={denseThClass}>المخزن</th>
                <th className={denseThClass}>الكمية</th>
                <th className={denseThClass}>السعر</th>
                <th className={denseThClass}>الإجمالي</th>
                <th className={denseThClass} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className={denseTrClass}>
                  <td className={denseTdClass}>
                    <ItemSelect
                      value={line.itemId}
                      onChange={(id) => {
                        const next = [...lines];
                        next[index] = { ...next[index], itemId: id };
                        setLines(next);
                      }}
                      disabled={readOnly}
                    />
                  </td>
                  <td className={denseTdClass}>
                    <WarehouseSelect
                      value={line.warehouseId}
                      onChange={(id) => {
                        const next = [...lines];
                        next[index] = { ...next[index], warehouseId: id };
                        setLines(next);
                      }}
                      disabled={readOnly}
                    />
                  </td>
                  <td className={denseTdClass}>
                    <TableNumberInput
                      value={line.quantity}
                      onValueCommit={(v) => {
                        const next = [...lines];
                        next[index] = { ...next[index], quantity: v };
                        setLines(next);
                      }}
                      disabled={readOnly}
                    />
                  </td>
                  <td className={denseTdClass}>
                    <TableNumberInput
                      value={line.unitPrice}
                      onValueCommit={(v) => {
                        const next = [...lines];
                        next[index] = { ...next[index], unitPrice: v };
                        setLines(next);
                      }}
                      disabled={readOnly}
                    />
                  </td>
                  <td className={denseTdClass + ' tabular-nums'}>
                    {((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toLocaleString('ar-EG', {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className={denseTdClass}>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={readOnly || lines.length <= 1}
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 gap-1"
            onClick={() => setLines([...lines, emptyLine()])}
          >
            <Plus className="h-4 w-4" /> سطر
          </Button>
        ) : null}
      </div>

      <FormStickyFooter
        status={
          <span className="text-sm text-slate-600">
            الإجمالي:{' '}
            <strong className="tabular-nums">
              {totalAmount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
            </strong>
          </span>
        }
      />

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر التوريد السابقة">
        <GenericRecordsList
          apiPath="/inventory/supply-orders"
          listKey="supply-orders-browse"
          selectedId={selectedId}
          onSelect={(id) => {
            openDoc(id);
            setBrowseOpen(false);
          }}
          columns={[
            { id: 'serial', header: 'المسلسل', getValue: (r) => String(r.serial ?? '—') },
            {
              id: 'customer',
              header: 'العميل',
              getValue: (r) => String((r as { customer?: { arabicName?: string } }).customer?.arabicName ?? '—'),
            },
            {
              id: 'date',
              header: 'التاريخ',
              getValue: (r) => (r.date ? String(r.date).slice(0, 10) : '—'),
            },
            {
              id: 'status',
              header: 'الحالة',
              getValue: (r) =>
                (r as { isCancelled?: boolean; isClosed?: boolean }).isCancelled
                  ? 'ملغي'
                  : (r as { isClosed?: boolean }).isClosed
                    ? 'مغلق'
                    : 'مفتوح',
            },
          ]}
        />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}
