'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { CompactFormField, compactControlClass } from '@/components/ui';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { printHtml } from '@/lib/print/printHtml';
import { useWarehousesQuery, type ItemOption, type WarehouseOption } from '@/lib/hooks/useMasterDataQueries';
import { useOpeningStockDraft } from '@/lib/hooks/useOpeningStockDraft';
import { apiClient } from '@/lib/api/client';
import { exportRowsToExcel } from '@/lib/export/export-utils';
import { getTenantContext, TENANT_CONTEXT_READY_EVENT } from '@/lib/tenant/tenant-context-storage';
import { mapClipboardFromField, parseClipboardDate } from '@/lib/clipboard-table-parser';
import {
  inventoryOpeningStockHeaderFormSchema,
  type InventoryOpeningStockHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { confirmAction } from '@/lib/feedback/confirm';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { OpeningStockHeader } from './OpeningStockHeader';
import { OpeningStockLinesTable } from './OpeningStockLinesTable';
import { OpeningStockStickyFooter } from './OpeningStockStickyFooter';
import { OpeningStockDraftBanner } from './OpeningStockDraftBanner';
import {
  emptyOpeningStockLine,
  formatMoney,
  isEnteredOpeningStockLine,
  lineValue,
  type OpeningStockLineForm,
} from './opening-stock-types';

type OpeningStockLineRecord = {
  itemId: string;
  warehouseId: string;
  quantity?: number | string;
  unitPrice?: number | string;
  item?: { code?: string | null; serial?: string | null; arabicName?: string | null };
  warehouse?: { arabicName?: string | null };
};

type OpeningStockRecord = {
  id: string;
  serial?: string | null;
  date?: string;
  description?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  totalAmount?: number | string;
  lines?: OpeningStockLineRecord[];
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parsePastedNumber(raw?: string) {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function itemUnitName(item: ItemOption) {
  return (
    item.units?.find((unit) => unit.isBaseUnit)?.unit?.arabicName ||
    item.units?.[0]?.unit?.arabicName ||
    ''
  );
}

function itemToLine(item: ItemOption, warehouseId: string): OpeningStockLineForm {
  return {
    itemId: item.id,
    itemCode: item.code || item.serial || '',
    itemName: item.arabicName,
    unitName: itemUnitName(item),
    warehouseId,
    quantity: 0,
    unitCost: toNumber(item.averageCost),
    batchNumber: '',
    expiryDate: '',
  };
}

function recordToLines(record: OpeningStockRecord): OpeningStockLineForm[] {
  const mapped = (record.lines ?? []).map((line) => ({
    itemId: line.itemId || '',
    itemCode: line.item?.code || line.item?.serial || '',
    itemName: line.item?.arabicName || '',
    unitName: '',
    warehouseId: line.warehouseId || '',
    quantity: toNumber(line.quantity),
    unitCost: toNumber(line.unitPrice),
    batchNumber: '',
    expiryDate: '',
  }));
  return mapped.length > 0 ? mapped : [emptyOpeningStockLine()];
}

function OpeningStockFormInner() {
  const invalidateQuery = useInvalidateQuery();
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [tenant, setTenant] = useState(() => getTenantContext());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<OpeningStockRecord | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadPending, setLoadPending] = useState(false);
  const [lifecyclePending, setLifecyclePending] = useState(false);

  useEffect(() => {
    const sync = () => setTenant(getTenantContext());
    window.addEventListener(TENANT_CONTEXT_READY_EVENT, sync);
    sync();
    return () => window.removeEventListener(TENANT_CONTEXT_READY_EVENT, sync);
  }, []);

  const {
    data: lines,
    setData: setLines,
    hasDraft,
    draftLineCount,
    restoreDraft,
    clearDraft,
    lastSaved,
  } = useOpeningStockDraft<OpeningStockLineForm>(
    tenant.companyId || '',
    tenant.fiscalYearId || '',
    [emptyOpeningStockLine()],
    { enabled: !selectedId }
  );

  const { data: warehousesResponse } = useWarehousesQuery(1000);
  const warehouses = useMemo(() => warehousesResponse?.data ?? [], [warehousesResponse?.data]);

  const { data: itemsResponse } = useApiQuery<ItemOption[]>(
    ['items', 'opening-stock-catalog'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const catalogItems = useMemo(() => itemsResponse?.data ?? [], [itemsResponse?.data]);
  const { data: existingOpeningRes } = useApiQuery<OpeningStockRecord[]>(
    ['opening-stock-browse', 'singleton'],
    '/inventory/opening-stock',
    { skip: 0, take: 1, isCancelled: false }
  );
  const existingOpeningStockId = existingOpeningRes?.data?.[0]?.id ?? null;

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InventoryOpeningStockHeaderFormInput>({
    resolver: zodResolver(inventoryOpeningStockHeaderFormSchema) as Resolver<InventoryOpeningStockHeaderFormInput>,
    defaultValues: {
      date: todayIso(),
      description: '',
      warehouseId: '',
    },
    mode: 'onTouched',
  });

  const date = watch('date');
  const warehouseId = watch('warehouseId');
  const defaultWarehouseId = warehouseId || warehouses[0]?.id || '';

  useEffect(() => {
    if (!warehouseId && warehouses[0]?.id) {
      setValue('warehouseId', warehouses[0].id, { shouldValidate: false });
    }
  }, [warehouseId, warehouses, setValue]);

  const isPosted = Boolean(loaded?.isPosted);
  const isCancelled = Boolean(loaded?.isCancelled);
  const hasDocument = Boolean(selectedId || loaded?.id);
  const gridLocked = isReadOnly || isPosted;

  const validLines = useMemo(
    () => lines.filter((line) => line.itemId && line.warehouseId && Number(line.quantity) > 0),
    [lines]
  );
  const itemCount = useMemo(() => lines.filter((line) => Boolean(line.itemId)).length, [lines]);
  const totalQuantity = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    [lines]
  );
  const totalValue = useMemo(() => lines.reduce((sum, line) => sum + lineValue(line), 0), [lines]);
  const canPost = !isPosted && (hasDocument || validLines.length > 0);
  const canSave = !gridLocked && !hasDocument && validLines.length > 0;
  const docNumber = loaded?.serial || `OS-${(date || todayIso()).slice(0, 4)}`;

  const findCatalogItem = useCallback(
    (codeOrName?: string) => {
      if (!codeOrName) return undefined;
      const q = codeOrName.trim().toLowerCase();
      return (
        catalogItems.find(
          (item) =>
            (item.code || '').toLowerCase() === q || (item.serial || '').toLowerCase() === q
        ) || catalogItems.find((item) => (item.arabicName || '').toLowerCase() === q)
      );
    },
    [catalogItems]
  );

  const findWarehouse = useCallback(
    (codeOrName?: string) => {
      if (!codeOrName) return undefined;
      const q = codeOrName.trim().toLowerCase();
      return (
        warehouses.find((row) => (row.code || '').toLowerCase() === q) ||
        warehouses.find((row) => (row.arabicName || '').toLowerCase() === q)
      );
    },
    [warehouses]
  );

  const applyRecord = (record: OpeningStockRecord) => {
    reset({
      date: record.date ? String(record.date).slice(0, 10) : todayIso(),
      description: record.description || '',
      warehouseId: record.lines?.[0]?.warehouseId || defaultWarehouseId,
    });
    setLines(recordToLines(record));
    setSelectedId(record.id);
    setLoaded(record);
    lockToView();
  };

  const createMutation = useApiMutation<OpeningStockRecord, Record<string, unknown>>(
    '/inventory/opening-stock',
    'POST',
    {
      showSuccessToast: false,
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء حفظ بضاعة أول المدة'),
    }
  );

  const persistDraft = async (): Promise<string | null> => {
    const values = getValues();
    if (hasDocument) {
      setError('هذا الكشف محفوظ مسبقاً. أنشئ كشفاً جديداً لتعديل البنود.');
      return selectedId;
    }
    if (validLines.length === 0) {
      setError('أدخل صنفاً وكمية أكبر من صفر في سطر واحد على الأقل');
      return null;
    }
    setError('');
    const payload = {
      description: values.description?.trim() || 'بضاعة أول المدة',
      date: new Date(`${values.date || todayIso()}T12:00:00`).toISOString(),
      lines: validLines.map((line) => ({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitCost) || 0,
        total: lineValue(line),
      })),
    };
    const res = await createMutation.mutateAsync(payload);
    const created = res.data;
    if (!created?.id) {
      setError('تعذر حفظ بضاعة أول المدة');
      return null;
    }
    clearDraft();
    invalidateQuery(['opening-stock']);
    return created.id;
  };

  const onSave = () => {
    void handleSubmit(async () => {
      const id = await persistDraft();
      if (!id) return;
      invalidateQuery(['opening-stock-browse']);
      await loadRecord(id);
      setSuccess('تم حفظ بضاعة أول المدة كمسودة');
    }, onFieldErrors(setError))();
  };

  const handleAddRow = () => {
    setLines((prev) => [...prev, emptyOpeningStockLine(defaultWarehouseId)]);
  };

  const handlePasteText = useCallback(
    (text: string, startField?: string, startIndex = 0) => {
      const mapped = mapClipboardFromField(text, startField || 'quantity');
      if (mapped.length === 0) return;
      setLines((prev) => {
        const next = [...prev];
        mapped.forEach((row, offset) => {
          const index = startIndex + offset;
          while (next.length <= index) next.push(emptyOpeningStockLine(defaultWarehouseId));
          const current = { ...next[index] };
          const matched = findCatalogItem(row.itemCode || row.itemName);
          if (matched) {
            current.itemId = matched.id;
            current.itemCode = matched.code || matched.serial || row.itemCode || current.itemCode;
            current.itemName = matched.arabicName;
            current.unitName = itemUnitName(matched);
            if (!current.unitCost) current.unitCost = toNumber(matched.averageCost);
          } else {
            if (row.itemCode) current.itemCode = row.itemCode;
            if (row.itemName) current.itemName = row.itemName;
            if (row.unitName) current.unitName = row.unitName;
          }
          const warehouse = findWarehouse(row.warehouseId);
          if (warehouse) current.warehouseId = warehouse.id;
          else if (!current.warehouseId) current.warehouseId = defaultWarehouseId;
          const qty = parsePastedNumber(row.quantity);
          if (qty != null) current.quantity = qty;
          const cost = parsePastedNumber(row.unitCost);
          if (cost != null) current.unitCost = cost;
          if (row.batchNumber) current.batchNumber = row.batchNumber;
          const expiry = parseClipboardDate(row.expiryDate);
          if (expiry) current.expiryDate = expiry;
          next[index] = current;
        });
        return next;
      });
    },
    [defaultWarehouseId, findCatalogItem, findWarehouse, setLines]
  );

  const handleLoadItems = async () => {
    if (gridLocked) return;
    const entered = lines.filter((line) => line.itemId || isEnteredOpeningStockLine(line));
    setLoadPending(true);
    try {
      const res = await apiClient.get<ItemOption[]>('/inventory/items', { limit: 1000, isActive: true });
      const items = res.data ?? [];
      if (items.length === 0) {
        setError('لا توجد أصناف نشطة في الدليل');
        return;
      }
      if (entered.length > 0) {
        const ok = await confirmAction(`سيتم إدراج ${items.length} صنف في الجدول، هل ترغب في المتابعة؟`);
        if (!ok) return;
      }
      const existingIds = new Set(lines.map((line) => line.itemId).filter(Boolean));
      const incoming = items
        .filter((item) => !existingIds.has(item.id))
        .map((item) => itemToLine(item, defaultWarehouseId));
      setLines((prev) => {
        const kept = prev.filter((line) => line.itemId);
        const base = kept.length > 0 ? kept : [];
        return [...base, ...incoming];
      });
      setSuccess(`تم تحميل ${incoming.length} صنفاً جاهزاً لإدخال الكمية والتكلفة`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الأصناف');
    } finally {
      setLoadPending(false);
    }
  };

  const handlePost = async () => {
    if (!(await confirmAction('هل تريد ترحيل كشف بضاعة أول المدة؟'))) return;
    setLifecyclePending(true);
    try {
      let id = selectedId;
      if (!id) {
        id = await persistDraft();
      }
      if (!id) return;
      const res = await apiClient.post<OpeningStockRecord>(`/inventory/opening-stock/${id}/post`);
      invalidateQuery(['opening-stock']);
      setLoaded((prev) => ({ ...(prev ?? res.data ?? { id }), ...(res.data ?? {}), isPosted: true }));
      lockToView();
      setSuccess('تم ترحيل بضاعة أول المدة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر ترحيل الكشف');
    } finally {
      setLifecyclePending(false);
    }
  };

  const handleUnpost = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('هل تريد فك ترحيل هذا الكشف؟'))) return;
    setLifecyclePending(true);
    try {
      await apiClient.post(`/inventory/opening-stock/${selectedId}/unpost`);
      invalidateQuery(['opening-stock']);
      setLoaded((prev) => (prev ? { ...prev, isPosted: false } : prev));
      setSuccess('تم فك ترحيل بضاعة أول المدة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فك الترحيل');
    } finally {
      setLifecyclePending(false);
    }
  };

  const handleVoid = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('هل تريد إلغاء كشف بضاعة أول المدة؟'))) return;
    setLifecyclePending(true);
    try {
      await apiClient.post(`/inventory/opening-stock/${selectedId}/cancel`);
      invalidateQuery(['opening-stock']);
      invalidateQuery(['opening-stock-browse']);
      setLoaded((prev) => (prev ? { ...prev, isCancelled: true } : prev));
      lockToView();
      setSuccess('تم إلغاء كشف بضاعة أول المدة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الكشف');
    } finally {
      setLifecyclePending(false);
    }
  };

  const resetNew = () => {
    if (existingOpeningStockId && !isCancelled) {
      setError('يوجد كشف بضاعة أول المدة بالفعل. احذفه أولاً حتى يمكن إنشاء كشف جديد.');
      return;
    }
    reset({ date: todayIso(), description: '', warehouseId: defaultWarehouseId });
    setLines([emptyOpeningStockLine(defaultWarehouseId)]);
    setSelectedId(null);
    setLoaded(null);
    setError('');
    setSuccess('');
    setMode('create');
  };

  const handleClearAll = async () => {
    if (gridLocked) return;
    if (!(await confirmAction('سيتم تفريغ جميع صفوف الجدول. هل تريد المتابعة؟'))) return;
    setLines([emptyOpeningStockLine(defaultWarehouseId)]);
    clearDraft();
  };

  const handlePrint = () => {
    const rows = lines
      .filter((line) => line.itemId || line.itemCode)
      .map(
        (line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${line.itemCode || ''}</td>
          <td>${line.itemName || ''}</td>
          <td>${line.unitName || ''}</td>
          <td>${warehouses.find((w) => w.id === line.warehouseId)?.arabicName || ''}</td>
          <td>${line.quantity || 0}</td>
          <td>${line.unitCost || 0}</td>
          <td>${lineValue(line).toFixed(2)}</td>
          <td>${line.batchNumber || ''}</td>
          <td>${line.expiryDate || ''}</td>
        </tr>`
      )
      .join('');
    void printHtml(`
      <html lang="ar" dir="rtl"><head><title>كشف بضاعة أول المدة</title>
      <style>
        body{font-family:sans-serif;padding:24px}
        h1{font-size:20px;margin-bottom:8px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}
        th{background:#f3f4f6}
      </style></head><body>
        <h1>كشف بضاعة أول المدة ${docNumber}</h1>
        <div>التاريخ: ${date || ''} — الحالة: ${isPosted ? 'مرحل ومثبت' : 'مسودة'}</div>
        <table>
          <thead><tr>
            <th>#</th><th>كود الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>المخزن</th>
            <th>الكمية</th><th>تكلفة الوحدة</th><th>الإجمالي</th><th>التشغيلة</th><th>الصلاحية</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p>عدد الأصناف: ${itemCount} — إجمالي الكميات: ${totalQuantity} — القيمة: ${formatMoney(totalValue)} ج.م</p>
      </body></html>
    `);
  };

  const handleExportExcel = async () => {
    const rows = lines
      .filter((line) => line.itemId || line.itemCode)
      .map((line, index) => [
        index + 1,
        line.itemCode,
        line.itemName,
        line.unitName,
        warehouses.find((w: WarehouseOption) => w.id === line.warehouseId)?.arabicName || '',
        line.quantity,
        line.unitCost,
        lineValue(line),
        line.batchNumber,
        line.expiryDate,
      ]);
    await exportRowsToExcel(
      `opening-stock-${docNumber}`,
      ['#', 'كود الصنف', 'اسم الصنف', 'الوحدة', 'المخزن', 'كمية أول المدة', 'تكلفة الوحدة', 'إجمالي القيمة', 'رقم التشغيلة', 'تاريخ الصلاحية'],
      rows,
      'بضاعة أول المدة'
    );
  };

  const handleRestoreDraft = () => {
    restoreDraft();
    setSuccess(
      draftLineCount > 0
        ? `تم استرجاع مسودة غير محفوظة تحتوي على ${draftLineCount} صنف`
        : 'تم استرجاع المسودة المحلية'
    );
  };

  const loadRecord = async (id: string) => {
    try {
      const res = await apiClient.get<OpeningStockRecord>(`/inventory/opening-stock/${id}`);
      if (res.data) applyRecord(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فتح الكشف');
    }
  };

  useEffect(() => {
    if (selectedId || !existingOpeningStockId) return;
    void loadRecord(existingOpeningStockId);
  }, [existingOpeningStockId, selectedId]);

  const saving = createMutation.isPending || lifecyclePending;

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        <OpeningStockHeader
          docNumber={docNumber}
          isPosted={isPosted}
          isReadOnly={isReadOnly}
          hasDocument={hasDocument}
          canPost={canPost}
          date={date}
          onDateChange={(value) => setValue('date', value, { shouldValidate: true })}
          dateError={Boolean(errors.date)}
          savePending={saving}
          canSave={canSave}
          loadPending={loadPending}
          onSave={onSave}
          onBrowseList={() => setBrowseOpen(true)}
          onLoadItems={() => void handleLoadItems()}
          onPost={() => void handlePost()}
          onUnpost={() => void handleUnpost()}
          onEdit={unlockForEdit}
          onPrint={handlePrint}
          onExportExcel={() => void handleExportExcel()}
          onClearAll={handleClearAll}
          onNew={resetNew}
          newDisabled={Boolean(existingOpeningStockId && !isCancelled)}
          onVoid={() => void handleVoid()}
          isCancelled={isCancelled}
        />

        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <CompactFormField label="المخزن الافتراضي">
            <WarehouseSelect
              value={warehouseId || ''}
              disabled={gridLocked}
              emptyLabel="اختر المخزن"
              onChange={(id) => setValue('warehouseId', id, { shouldValidate: false })}
            />
          </CompactFormField>
          <CompactFormField label="الشرح">
            <input
              className={compactControlClass}
              disabled={gridLocked}
              placeholder="بيان كشف بضاعة أول المدة"
              value={watch('description') || ''}
              onChange={(e) => setValue('description', e.target.value, { shouldValidate: false })}
            />
          </CompactFormField>
        </div>

        {hasDraft ? (
          <OpeningStockDraftBanner
            count={draftLineCount}
            onRestore={handleRestoreDraft}
            onDismiss={clearDraft}
          />
        ) : null}

        {gridLocked ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            الكشف للعرض فقط. استخدم قائمة الإجراءات (…) لتعديل أو فك الترحيل.
          </div>
        ) : null}

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <OpeningStockLinesTable
          lines={lines}
          onChange={setLines}
          onAddRow={handleAddRow}
          onPasteText={handlePasteText}
          disabled={gridLocked}
          defaultWarehouseId={defaultWarehouseId}
        />

        <OpeningStockStickyFooter
          itemCount={itemCount}
          totalQuantity={totalQuantity}
          totalValue={totalValue}
          lastSaved={lastSaved}
          savePending={saving}
          canSave={canSave}
          onSave={onSave}
          onCancel={resetNew}
        />

        <DocumentBrowseDrawer
          open={browseOpen}
          onClose={() => setBrowseOpen(false)}
          title="كشوف بضاعة أول المدة السابقة"
        >
          <GenericRecordsList
            apiPath="/inventory/opening-stock"
            listKey="opening-stock-browse"
            paging="skip"
            selectedId={selectedId}
            searchPlaceholder="بحث برقم الكشف…"
            columns={[
              {
                id: 'serial',
                header: 'الرقم',
                getValue: (row) => String(row.serial ?? String(row.id).slice(0, 8)),
              },
              {
                id: 'date',
                header: 'التاريخ',
                getValue: (row) =>
                  row.date ? new Date(String(row.date)).toLocaleDateString('ar-EG') : '—',
              },
              {
                id: 'total',
                header: 'القيمة',
                getValue: (row) => formatMoney(toNumber(row.totalAmount)),
              },
            ]}
            resolveStatus={(row) =>
              row.isPosted
                ? { variant: 'success', label: 'مرحل' }
                : { variant: 'warning', label: 'مسودة' }
            }
            onSelect={(id) => {
              setBrowseOpen(false);
              void loadRecord(id);
            }}
          />
        </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}

export function OpeningStockForm() {
  return (
    <DocumentModeProvider initialMode="create">
      <OpeningStockFormInner />
    </DocumentModeProvider>
  );
}
