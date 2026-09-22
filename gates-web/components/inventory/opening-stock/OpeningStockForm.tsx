'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { localizeUnknownError } from '@/lib/api/localize-api-error-message';
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
  summarizeOpeningStockIssues,
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

function isoDatePart(value?: string | null) {
  return String(value || '').slice(0, 10);
}

function dayBeforeIso(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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

  const { data: warehousesResponse } = useWarehousesQuery(1000, { leafOnly: true });
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
    { skip: 0, take: 20 }
  );
  const existingOpenings = existingOpeningRes?.data ?? [];
  const existingOpeningStockId =
    existingOpenings.find((row) => !row.isCancelled)?.id ?? existingOpenings[0]?.id ?? null;
  const { data: openingMetaRes } = useApiQuery<{
    openingDate?: string;
    fiscalYearName?: string | null;
  }>(['opening-balance-meta'], '/accounting/opening-balance', undefined, {
    requireFullTenant: false,
  });
  const { data: fiscalYearsRes } = useApiQuery<
    { startDate?: string; arabicName?: string | null; englishName?: string | null }[]
  >(['company-fiscal-years'], '/company/fiscal-years', { page: 1, limit: 50 }, {
    requireFullTenant: false,
  });
  const firstFiscalYear = useMemo(() => {
    const rows = Array.isArray(fiscalYearsRes?.data) ? fiscalYearsRes.data : [];
    return [...rows].sort((a, b) => isoDatePart(a.startDate).localeCompare(isoDatePart(b.startDate)))[0];
  }, [fiscalYearsRes?.data]);
  const lockedOpeningDate =
    isoDatePart(openingMetaRes?.data?.openingDate) ||
    (isoDatePart(firstFiscalYear?.startDate) ? dayBeforeIso(isoDatePart(firstFiscalYear?.startDate)) : '');
  const fiscalYearName =
    openingMetaRes?.data?.fiscalYearName ||
    firstFiscalYear?.arabicName ||
    firstFiscalYear?.englishName ||
    undefined;

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
      date: lockedOpeningDate || todayIso(),
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

  useEffect(() => {
    if (!defaultWarehouseId) return;
    setLines((prev) => {
      if (!prev.some((line) => !line.warehouseId)) return prev;
      return prev.map((line) =>
        line.warehouseId ? line : { ...line, warehouseId: defaultWarehouseId }
      );
    });
  }, [defaultWarehouseId, setLines]);

  useEffect(() => {
    if (!lockedOpeningDate || selectedId) return;
    setValue('date', lockedOpeningDate, { shouldValidate: false });
  }, [lockedOpeningDate, selectedId, setValue]);

  const isPosted = Boolean(loaded?.isPosted);
  const isCancelled = Boolean(loaded?.isCancelled);
  const hasDocument = Boolean(selectedId || loaded?.id);
  const gridLocked = isReadOnly || isPosted;

  const linesRef = useRef(lines);
  linesRef.current = lines;

  const validLines = useMemo(
    () =>
      lines
        .map((line) => ({
          ...line,
          warehouseId: line.warehouseId || defaultWarehouseId,
        }))
        .filter((line) => line.itemId && line.warehouseId && Number(line.quantity) > 0),
    [defaultWarehouseId, lines]
  );
  const itemCount = useMemo(() => lines.filter((line) => Boolean(line.itemId)).length, [lines]);
  const totalQuantity = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    [lines]
  );
  const totalValue = useMemo(() => lines.reduce((sum, line) => sum + lineValue(line), 0), [lines]);
  const canPost = !isPosted && (hasDocument || validLines.length > 0);
  const canSave =
    !isPosted &&
    !isReadOnly &&
    lines.some((line) => Boolean(line.itemId || line.itemCode || Number(line.quantity) > 0));
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
      date: record.date ? String(record.date).slice(0, 10) : lockedOpeningDate || todayIso(),
      description: record.description || '',
      warehouseId: record.lines?.[0]?.warehouseId || defaultWarehouseId,
    });
    setLines(recordToLines(record));
    setSelectedId(record.id);
    setLoaded(record);
    if (record.isCancelled || !record.isPosted) unlockForEdit();
    else lockToView();
  };

  const createMutation = useApiMutation<OpeningStockRecord, Record<string, unknown>>(
    '/inventory/opening-stock',
    'POST',
    {
      showSuccessToast: false,
      onError: (err: ApiError) => setError(localizeUnknownError(err) || 'حدث خطأ أثناء حفظ بضاعة أول المدة'),
    }
  );

  const persistDraft = async (): Promise<string | null> => {
    const values = getValues();
    if (isPosted) {
      setError('الكشف مرحّل. فك الترحيل أولاً حتى يمكن تعديل البنود.');
      return selectedId;
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    const latest = linesRef.current.map((line) => {
      const resolved = line.itemId ? undefined : findCatalogItem(line.itemCode || line.itemName);
      return {
        ...line,
        itemId: line.itemId || resolved?.id || '',
        itemCode: line.itemCode || resolved?.code || resolved?.serial || '',
        itemName: line.itemName || resolved?.arabicName || '',
        unitName: line.unitName || (resolved ? itemUnitName(resolved) : ''),
        warehouseId: line.warehouseId || defaultWarehouseId,
        unitCost: line.unitCost || (resolved ? toNumber(resolved.averageCost) : 0),
      };
    });
    if (
      latest.some(
        (line, index) =>
          line.itemId !== lines[index]?.itemId || line.warehouseId !== lines[index]?.warehouseId
      )
    ) {
      setLines(latest);
    }
    const ready = latest.filter((line) => line.itemId && Number(line.quantity) > 0);
    if (ready.length === 0) {
      const issues = summarizeOpeningStockIssues(latest);
      setError(
        issues[0] || 'أدخل صنفاً من الدليل وكمية أكبر من صفر في سطر واحد على الأقل'
      );
      return null;
    }
    setError('');
    const datePart = isoDatePart(lockedOpeningDate || values.date) || todayIso();
    const payloadDate = new Date(`${datePart}T12:00:00`);
    if (Number.isNaN(payloadDate.getTime())) {
      setError('تاريخ الكشف غير صالح. راجع تاريخ أول المدة في إعدادات السنة المالية.');
      return null;
    }
    const payload = {
      description: values.description?.trim() || 'بضاعة أول المدة',
      date: payloadDate.toISOString(),
      lines: ready.map((line) => ({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitCost) || 0,
        total: lineValue(line),
      })),
    };
    try {
      const targetId = selectedId || existingOpeningStockId;
      const res = targetId
        ? await apiClient.put<OpeningStockRecord>(`/inventory/opening-stock/${targetId}`, payload)
        : await createMutation.mutateAsync(payload);
      const saved = res.data;
      if (!saved?.id) {
        setError('تعذر حفظ بضاعة أول المدة');
        return null;
      }
      clearDraft();
      applyRecord(saved);
      invalidateQuery(['opening-stock']);
      invalidateQuery(['opening-stock-browse']);
      return saved.id;
    } catch (err) {
      setError(localizeUnknownError(err));
      return null;
    }
  };

  const onSave = () => {
    void handleSubmit(async () => {
      const id = await persistDraft();
      if (!id) return;
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
        .filter((item) => !existingIds.has(item.id) && !(item as ItemOption & { isService?: boolean }).isService)
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
    if (isCancelled) {
      setError('الكشف ملغي. استرجعه من قائمة (...) قبل الترحيل.');
      return;
    }
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
      unlockForEdit();
      setSuccess('تم إلغاء نفس الكشف. البنود موجودة وتقدر تعدّلها — «جديد» مقفول.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الكشف');
    } finally {
      setLifecyclePending(false);
    }
  };

  const resetNew = () => {
    if (existingOpeningStockId) {
      setError('يوجد كشف بضاعة أول المدة بالفعل. عدّل نفس الكشف أو استرجعه إن كان ملغياً.');
      return;
    }
    reset({ date: lockedOpeningDate || todayIso(), description: '', warehouseId: defaultWarehouseId });
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
        <div>التاريخ: ${date || ''} — الحالة: ${isCancelled ? 'ملغي' : isPosted ? 'مرحل ومثبت' : 'مسودة'}</div>
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

  const handleRestore = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('استعادة كشف بضاعة أول المدة الملغي؟'))) return;
    setLifecyclePending(true);
    try {
      await apiClient.post(`/inventory/opening-stock/${selectedId}/restore`);
      invalidateQuery(['opening-stock']);
      invalidateQuery(['opening-stock-browse']);
      setLoaded((prev) => (prev ? { ...prev, isCancelled: false } : prev));
      unlockForEdit();
      setSuccess('تم استعادة نفس كشف بضاعة أول المدة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استعادة الكشف');
    } finally {
      setLifecyclePending(false);
    }
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
          date={lockedOpeningDate || date}
          dateError={Boolean(errors.date)}
          fiscalYearName={fiscalYearName}
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
          newDisabled={Boolean(existingOpeningStockId || selectedId)}
          newHint="يوجد كشف بضاعة أول المدة بالفعل. عدّل نفس الكشف أو استرجعه إن كان ملغياً."
          onVoid={() => void handleVoid()}
          onRestore={() => void handleRestore()}
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

        {isCancelled ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
            الكشف ملغي على نفس الرقم. البنود موجودة وتقدر تعدّلها. «جديد» مقفول — استرجع هذا الكشف من قائمة (...). لو فيه كشف تاني شغال، ألغِه الأول.
          </div>
        ) : null}

        {gridLocked ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            الكشف للعرض فقط. استخدم قائمة الإجراءات (…) لتعديل أو فك الترحيل.
          </div>
        ) : null}

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <div className="mb-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-xs text-[#0A3D5E]">
          شروط السطر: <strong>صنف من الدليل</strong> + <strong>مخزن تشغيلي</strong> +{' '}
          <strong>كمية أكبر من صفر</strong>. التكلفة اختيارية (صفر مسموح). الأصناف الخدمية أو غير النشطة لا تُحفظ.
        </div>

        <OpeningStockLinesTable
          lines={lines}
          onChange={setLines}
          onAddRow={handleAddRow}
          onPasteText={handlePasteText}
          disabled={gridLocked}
          defaultWarehouseId={defaultWarehouseId}
          onResolveItemCode={(index, code) => {
            if (lines[index]?.itemId) return;
            const matched = findCatalogItem(code);
            if (!matched) return;
            setLines((prev) =>
              prev.map((line, i) =>
                i === index
                  ? {
                      ...line,
                      itemId: matched.id,
                      itemCode: matched.code || matched.serial || code,
                      itemName: matched.arabicName,
                      unitName: itemUnitName(matched),
                      warehouseId: line.warehouseId || defaultWarehouseId,
                      unitCost: line.unitCost || toNumber(matched.averageCost),
                    }
                  : line
              )
            );
          }}
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
              row.isCancelled
                ? { variant: 'danger', label: 'ملغي' }
                : row.isPosted
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
