'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import {
  FormSectionCard,
  CompactFormField,
  FormStickyFooter,
  Button,
  IconButton,
  compactControlClass,
  compactLabelClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { ItemGroupSelect } from '@/app/components/form/ItemGroupSelect';
import { useStockMovementPanel } from '@/lib/inventory/use-stock-movement-panel';
import { resolvePriceListPurchasePrice } from '@/lib/inventory/pricing-engine';
import {
  applyStocktakingSheetToLines,
  exportStocktakingLinesToExcel,
  parseStocktakingSheet,
  type StocktakingImportItem,
} from '@/lib/inventory/stocktaking-excel';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryStocktakingPageFormSchema,
  type InventoryStocktakingPageFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError, ApiResponse } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { postSuccessMessage } from '@/lib/inventory/use-document-post-mutation';
import {
  useStoreDocumentSerial,
  STORE_DOCUMENT_UNPOSTED_LABEL,
} from '@/lib/inventory/use-store-document-serial';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { dispatchAcademyTrigger } from '@/lib/onboarding/tourCheckpoints';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import {
  mapSourcePayloadToStocktakingLines,
  stockHeaderFieldsFromSource,
} from '@/lib/inventory/apply-source-to-stock-document';
import { STOCK_LINE_COPY_SOURCE_TYPES, type SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';

import { formatMoneyAr } from '@/lib/formatMoney';

function stocktakingUnitCost(row: {
  averageCost?: number | string | null;
  item?: { averageCost?: unknown; lastPurchasePrice?: unknown };
}): number {
  const warehouseCost = Number(row.averageCost);
  if (Number.isFinite(warehouseCost) && warehouseCost > 0) return warehouseCost;
  const itemCost = Number(row.item?.averageCost ?? row.item?.lastPurchasePrice);
  return Number.isFinite(itemCost) && itemCost > 0 ? itemCost : 0;
}

interface StocktakingLine {
  itemId: string;
  bookValue: number;
  actualValue: number;
  shortage: number;
  surplus: number;
  /** متوسط التكلفة — للعرض فقط */
  averageUnitCost: number;
  /** يُرسل للترحيل (عجز: متوسط التكلفة، زيادة: قائمة الأسعار إن وُجدت) */
  unitPrice: number;
}

function emptyStocktakingDefaults(today: string): InventoryStocktakingPageFormInput {
  return {
    serialNumber: '',
    description: '',
    date: today,
    hijriDate: '',
    warehouseId: '',
    isPosted: false,
    isApproved: false,
    useBarcode: false,
    hideExistingQty: false,
    loadScope: 'withBalance',
  };
}

function lineFromQuantities(
  itemId: string,
  bookValue: number,
  actualValue: number,
  averageUnitCost: number,
  unitPrice?: number
): StocktakingLine {
  const delta = actualValue - bookValue;
  const avg = averageUnitCost > 0 ? averageUnitCost : 0;
  const price = unitPrice && unitPrice > 0 ? unitPrice : avg;
  return {
    itemId,
    bookValue,
    actualValue,
    shortage: delta < 0 ? -delta : 0,
    surplus: delta > 0 ? delta : 0,
    averageUnitCost: avg,
    unitPrice: price,
  };
}

type StocktakingDetail = {
  id: string;
  serial?: string | null;
  description?: string | null;
  date?: string;
  hijriDate?: string | null;
  warehouseId?: string | null;
  isPosted?: boolean;
  isApproved?: boolean;
  journalEntryId?: string | null;
  record?: string | null;
  lines?: Array<{
    itemId: string;
    bookQuantity?: number | string;
    actualQuantity?: number | string;
    shortageQuantity?: number | string;
    increaseQuantity?: number | string;
    unitPrice?: number | string;
  }>;
};

export default function StocktakingPage() {
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const todayStr = new Date().toISOString().split('T')[0];

  const inputCls = compactControlClass;
  const labelCls = compactLabelClass;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<InventoryStocktakingPageFormInput>({
    resolver: zodResolver(inventoryStocktakingPageFormSchema) as Resolver<InventoryStocktakingPageFormInput>,
    defaultValues: emptyStocktakingDefaults(todayStr),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');

  const [stocktakingLines, setStocktakingLines] = useState<StocktakingLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [documentId, setDocumentId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const [showList, setShowList] = useState(false);
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const openStocktaking = (id: string | null) => {
    setDocumentId(id);
    if (typeof window === 'undefined') return;
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };
  const [refreshing, setRefreshing] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [filterItemGroupId, setFilterItemGroupId] = useState('');
  const [filterItemId, setFilterItemId] = useState('');
  const [surplusPriceListId, setSurplusPriceListId] = useState('');
  const excelInputRef = useRef<HTMLInputElement>(null);
  const warehouseId = watch('warehouseId');
  const loadScope = watch('loadScope');

  const setSerialNumber = useCallback(
    (value: string) =>
      setValue('serialNumber', value, { shouldDirty: false, shouldValidate: false }),
    [setValue]
  );
  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'stocktaking',
    enabled: !documentId,
    setSerial: setSerialNumber,
  });

  const { data: stocktakingDetail } = useApiQuery<StocktakingDetail>(
    ['stocktaking', documentId],
    documentId ? `/inventory/stocktaking/${documentId}` : '/inventory/stocktaking',
    undefined,
    { enabled: Boolean(documentId) }
  );
  const { data: stocktakingList } = useApiQuery<StocktakingDetail[]>(
    ['stocktaking-list'],
    '/inventory/stocktaking',
    { take: 50 },
    { enabled: showList }
  );
  const { data: itemGroupsRes } = useApiQuery<{ id: string; arabicName: string; code?: string }[]>(
    ['item-categories', { limit: 500 }],
    '/inventory/item-categories',
    { limit: 500, isActive: true }
  );
  const itemGroups = itemGroupsRes?.data ?? [];
  const { data: priceListsRes } = useApiQuery<
    { id: string; arabicName: string; code?: string; isActive?: boolean }[]
  >(['price-lists', 'stocktaking'], '/inventory/price-lists', { limit: 200, isActive: true });
  const priceLists = (priceListsRes?.data ?? []).filter((pl) => pl.isActive !== false);

  const stockPanel = useStockMovementPanel(
    documentId,
    Boolean(isPosted),
    stocktakingDetail?.data?.journalEntryId
  );

  const hydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    hydratedIdRef.current = null;
  }, [documentId]);
  useEffect(() => {
    const row = stocktakingDetail?.data;
    if (!row || row.id !== documentId || hydratedIdRef.current === row.id) return;
    hydratedIdRef.current = row.id;
    reset({
      ...emptyStocktakingDefaults(todayStr),
      serialNumber: row.serial ?? '',
      description: row.description ?? '',
      date: row.date ? String(row.date).slice(0, 10) : todayStr,
      hijriDate: row.hijriDate ?? '',
      warehouseId: row.warehouseId ?? '',
      isPosted: Boolean(row.isPosted),
      isApproved: Boolean(row.isApproved),
    });
    setStocktakingLines(
      (row.lines ?? []).map((line) => {
        const bookValue = Number(line.bookQuantity || 0);
        const actualValue = Number(line.actualQuantity || 0);
        const unitPrice = Number(line.unitPrice || 0);
        return lineFromQuantities(line.itemId, bookValue, actualValue, unitPrice, unitPrice);
      })
    );
  }, [stocktakingDetail, documentId, reset, todayStr]);

  const stockTotals = useMemo(() => {
    let surplus = 0;
    let shortage = 0;
    for (const line of stocktakingLines) {
      const avg = line.averageUnitCost || line.unitPrice;
      shortage += (line.shortage ?? 0) * avg;
      const surplusUnit = line.surplus > 0 ? line.unitPrice : avg;
      surplus += (line.surplus ?? 0) * surplusUnit;
    }
    return { surplus, shortage };
  }, [stocktakingLines]);

  const postAfterSaveRef = useRef(false);
  const [postPending, setPostPending] = useState(false);

  const applyPostSuccess = useCallback(
    (res: ApiResponse<unknown>, savedId: string) => {
      setSuccess(postSuccessMessage(res));
      setValue('isPosted', true);
      stockPanel.onPosted(res);
      invalidateStockViews(invalidateQuery);
      invalidateQuery(['stocktaking', savedId]);
      hydratedIdRef.current = null;
    },
    [invalidateQuery, setValue, stockPanel]
  );

  const clearStocktakingForNext = () => {
    openStocktaking(null);
    stockPanel.resetPanel();
    setStocktakingLines([]);
    setFilterItemGroupId('');
    setFilterItemId('');
    setSurplusPriceListId('');
    reset(emptyStocktakingDefaults(new Date().toISOString().split('T')[0]));
    setSourceBarKey((k) => k + 1);
  };

  const finishSavedStocktaking = useCallback(
    (args: { number?: string; savedId?: string; posted?: boolean }) => {
      finishDocumentSave({
        label: 'تسوية الجرد المخزني',
        number: args.number,
        posted: args.posted,
        savedId: args.savedId,
        cleared: false,
        onOpen: (saved) => openStocktaking(saved),
        onSavedOpen: (saved) => invalidateQuery(['stocktaking', saved]),
        reset: clearStocktakingForNext,
      });
      dispatchAcademyTrigger('API_SUCCESS', 'stocktaking.save-success');
    },
    [invalidateQuery]
  );

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, watch('description'));
    if (header.warehouseId) setValue('warehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    setStocktakingLines(
      mapSourcePayloadToStocktakingLines(payload).map((line) =>
        lineFromQuantities(
          line.itemId,
          line.bookValue,
          line.actualValue,
          line.unitPrice,
          line.unitPrice
        )
      )
    );
    toast.success(`تم تحميل البنود من ${payload.sourceNumber}`);
  };

  const stocktakingMutation = useApiMutation<{ id?: string; serial?: string; serialNumber?: string }, Record<string, unknown>>(
    '/inventory/stocktaking',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const createdId = res.data?.id;
        const number = res.data?.serialNumber || res.data?.serial;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        if (shouldPost && createdId) {
          setPostPending(true);
          void apiClient
            .post(`/inventory/stocktaking/${createdId}/post`)
            .then((res) => {
              applyPostSuccess(res, createdId);
              finishSavedStocktaking({ number, savedId: createdId, posted: true });
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر تنفيذ التسوية');
              openStocktaking(createdId);
              finishSavedStocktaking({ number, savedId: createdId, posted: false });
            })
            .finally(() => setPostPending(false));
          return;
        }
        finishSavedStocktaking({ number, savedId: createdId, posted: false });
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const [updatePending, setUpdatePending] = useState(false);
  const loading = stocktakingMutation.isPending || updatePending || postPending;

  useEffect(() => {
    reset((prev) => ({ ...prev, date: prev.date || todayStr }));
  }, [todayStr, reset]);

  const handleNew = () => {
    setError('');
    setSuccess('');
    clearStocktakingForNext();
  };

  const handleUnpost = () => {
    if (!documentId) {
      setError('احفظ الجرد أولاً');
      return;
    }
    setError('');
    void apiClient
      .post(`/inventory/stocktaking/${documentId}/unpost`)
      .then(() => {
        setValue('isPosted', false);
        setSuccess('تم إلغاء التسوية');
        stockPanel.resetPanel();
        invalidateQuery(['stocktaking', documentId]);
        invalidateStockViews(invalidateQuery);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر إلغاء الترحيل');
      });
  };

  const applyWarehouseBookToLine = useCallback(
    async (itemId: string, index: number, keepActualIfSet?: boolean) => {
      if (!warehouseId || !itemId) return;
      try {
        const res = await apiClient.get<{
          quantityOnHand?: number;
          averageCost?: number;
        }>(`/inventory/items/${itemId}/stock-balance`, { warehouseId });
        const bookValue = Number(res.data?.quantityOnHand) || 0;
        const unitPrice = Number(res.data?.averageCost) || 0;
        setStocktakingLines((prev) => {
          const next = [...prev];
          const line = next[index];
          if (!line || line.itemId !== itemId) return prev;
          const actualValue =
            keepActualIfSet && line.actualValue > 0 ? line.actualValue : bookValue;
          const avg = unitPrice > 0 ? unitPrice : line.averageUnitCost;
          next[index] = lineFromQuantities(itemId, bookValue, actualValue, avg, line.unitPrice);
          return next;
        });
      } catch {
        /* balance row may not exist yet */
      }
    },
    [warehouseId]
  );

  const applySurplusUnitPricesFromList = useCallback(
    async (listId: string, lines: StocktakingLine[]) => {
      if (!listId.trim()) {
        return lines.map((line) => ({
          ...line,
          unitPrice: line.averageUnitCost || line.unitPrice,
        }));
      }
      const res = await apiClient.get<
        {
          id: string;
          averageCost?: number | string;
          lastPurchasePrice?: number | string;
          itemPrices?: Array<{
            purchasePrice?: number | string | null;
            retailPrice?: number | string | null;
            price?: number | string | null;
            priceList?: { id?: string; priceMode?: string | null; isActive?: boolean | null };
          }>;
        }[]
      >('/inventory/items', { limit: 2000, isActive: true });
      const catalog = res.data ?? [];
      return lines.map((line) => {
        if (!line.itemId || line.surplus <= 0) {
          return { ...line, unitPrice: line.averageUnitCost || line.unitPrice };
        }
        const item = catalog.find((row) => row.id === line.itemId);
        const listPrice = item
          ? resolvePriceListPurchasePrice(
              item as Parameters<typeof resolvePriceListPurchasePrice>[0],
              listId
            )
          : 0;
        const price = listPrice > 0 ? listPrice : line.averageUnitCost || line.unitPrice;
        return { ...line, unitPrice: price };
      });
    },
    []
  );

  const handleRefreshStock = async () => {
    setError('');
    setSuccess('');
    if (!warehouseId) {
      setError('يرجى اختيار المخزن أولاً');
      return;
    }
    setRefreshing(true);
    try {
      const query = filterItemId ? `?itemId=${encodeURIComponent(filterItemId)}` : '';
      const res = await apiClient.get<
        {
          itemId?: string;
          quantity?: number | string;
          quantityOnHand?: number | string;
          averageCost?: number | string;
          item?: {
            averageCost?: unknown;
            lastPurchasePrice?: unknown;
            categoryId?: string | null;
          };
        }[]
      >(`/inventory/item-quantities/warehouse/${warehouseId}${query}`);
      const rows = Array.isArray(res.data) ? res.data : [];
      let next = rows
        .map((row) => {
          const bookValue = Number(row.quantityOnHand ?? row.quantity) || 0;
          const avg = stocktakingUnitCost(row);
          const itemId = String(row.itemId ?? '');
          return lineFromQuantities(itemId, bookValue, bookValue, avg, avg);
        })
        .filter((line) => line.itemId);
      if (filterItemGroupId) {
        next = next.filter((line) => {
          const row = rows.find((r) => r.itemId === line.itemId);
          return row?.item?.categoryId === filterItemGroupId;
        });
      }
      if (loadScope === 'withBalance') {
        next = next.filter((line) => line.bookValue !== 0);
      } else if (loadScope === 'negativeOnly') {
        next = next.filter((line) => line.bookValue < 0);
      }
      next = await applySurplusUnitPricesFromList(surplusPriceListId, next);
      setStocktakingLines(next);
      if (!next.length) {
        setError('لا توجد أصناف مطابقة للفلتر في هذا المخزن');
        return;
      }
      setSuccess('تم تحميل أرصدة المخزن');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل أرصدة المخزن');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportExcel = async () => {
    const itemRes = await apiClient.get<StocktakingImportItem[]>('/inventory/items', {
      limit: 2000,
      isActive: true,
    });
    const catalog = itemRes.data ?? [];
    const byId = new Map(catalog.map((i) => [i.id, i]));
    const rows = stocktakingLines
      .filter((l) => l.itemId)
      .map((line) => {
        const item = byId.get(line.itemId);
        return {
          itemCode: item?.code || item?.serial || line.itemId.slice(0, 8),
          itemName: item?.arabicName || '',
          bookQuantity: line.bookValue,
          actualQuantity: line.actualValue,
          averageUnitCost: line.averageUnitCost || line.unitPrice,
        };
      });
    if (!rows.length) {
      setError('لا توجد بنود للتصدير');
      return;
    }
    const serial = watch('serialNumber') || 'stocktaking';
    await exportStocktakingLinesToExcel(`stocktaking-${serial}`, rows);
    setSuccess('تم تصدير الشيت');
  };

  const handleImportExcel = async (file: File) => {
    if (isPosted) {
      setError('لا يمكن استيراد شيت على مستند مرحّل');
      return;
    }
    setSheetBusy(true);
    setError('');
    try {
      const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        setError('الملف لا يحتوي على ورقة عمل');
        return;
      }
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const parsed = parseStocktakingSheet(matrix);
      if (!parsed.length) {
        setError('الشيت فارغ أو الأعمدة غير معروفة');
        return;
      }
      const itemRes = await apiClient.get<StocktakingImportItem[]>('/inventory/items', {
        limit: 2000,
        isActive: true,
      });
      const draft = stocktakingLines.map((line) => ({
        itemId: line.itemId,
        bookValue: line.bookValue,
        actualValue: line.actualValue,
        shortage: line.shortage,
        surplus: line.surplus,
        averageUnitCost: line.averageUnitCost,
        unitPrice: line.unitPrice,
      }));
      const { lines, matched, missed } = applyStocktakingSheetToLines(
        parsed,
        itemRes.data ?? [],
        draft
      );
      let next = lines as StocktakingLine[];
      next = await applySurplusUnitPricesFromList(surplusPriceListId, next);
      setStocktakingLines(next);
      setSuccess(
        missed
          ? `تم استيراد ${matched} صف، و${missed} صف بدون صنف مطابق`
          : `تم استيراد ${matched} صف من الشيت`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة الشيت');
    } finally {
      setSheetBusy(false);
    }
  };

  const handleSave = () =>
    void handleSubmit((values) => {
      setError('');
      setSuccess('');
      if (values.isPosted) {
        postAfterSaveRef.current = false;
        setError('لا يمكن تعديل جرد مرحّل');
        return;
      }
      const filled = stocktakingLines.filter((line) => line.itemId);
      if (filled.length === 0) {
        postAfterSaveRef.current = false;
        setError('يرجى إضافة أصناف لتسوية الجرد');
        return;
      }
      const payload = {
        serial: values.serialNumber || undefined,
        description: values.description,
        date: new Date(values.date).toISOString(),
        hijriDate: values.hijriDate || undefined,
        warehouseId: values.warehouseId,
        lines: filled.map((line) => ({
          itemId: line.itemId,
          warehouseId: values.warehouseId,
          bookQuantity: line.bookValue,
          actualQuantity: line.actualValue,
          unitPrice:
            line.surplus > 0 ? line.unitPrice : line.averageUnitCost || line.unitPrice,
          shortageQuantity: line.shortage,
          increaseQuantity: line.surplus,
        })),
      };
      if (documentId) {
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const savedId = documentId;
        const number = values.serialNumber;
        setUpdatePending(true);
        void apiClient
          .put(`/inventory/stocktaking/${documentId}`, payload)
          .then(() => {
            hydratedIdRef.current = null;
            invalidateStockViews(invalidateQuery);
            if (shouldPost) {
              setPostPending(true);
              return apiClient
                .post(`/inventory/stocktaking/${savedId}/post`)
                .then((res) => {
                  applyPostSuccess(res, savedId);
                  finishSavedStocktaking({ number, savedId, posted: true });
                })
                .finally(() => setPostPending(false));
            }
            finishSavedStocktaking({ number, savedId, posted: false });
          })
          .catch((err: unknown) => {
            postAfterSaveRef.current = false;
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
          })
          .finally(() => setUpdatePending(false));
        return;
      }
      stocktakingMutation.mutate(payload);
    }, onFieldErrors(setError))();

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'تسوية الجرد المخزني' },
        ]}
        title="تسوية الجرد المخزني"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL}
        saveLabel="حفظ"
        onSaveDraft={() => {
          postAfterSaveRef.current = false;
          handleSave();
        }}
        savePending={loading}
        canSave={!loading && !isPosted}
        postLabel="تسوية الجرد"
        postPending={postPending}
        canPost={!loading && !isPosted && stocktakingLines.some((l) => l.itemId)}
        onPost={() => {
          postAfterSaveRef.current = true;
          handleSave();
        }}
        hideStandalonePost={false}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        favoriteHref="/inventory/operations/stocktaking"
        standardActions={{
          hasDocument: Boolean(documentId) || stocktakingLines.some((l) => l.itemId),
          isPosted: Boolean(isPosted),
          hidePostActions: true,
          onUnpost: handleUnpost,
          unpostLabel: 'إلغاء التسوية',
          onNew: handleNew,
          newLabel: 'جديد',
        }}
        extraActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={stocktakingLines.some((l) => Boolean(l.itemId))}
            disabled={Boolean(isPosted)}
            allowedTypes={STOCK_LINE_COPY_SOURCE_TYPES}
            onHydrate={handleSourceHydrate}
          />
        }
      />
      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="تسويات الجرد السابقة">
        <div className="divide-y">
          {(stocktakingList?.data ?? []).map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex w-full items-center justify-between py-2 text-right text-sm"
              onClick={() => {
                openStocktaking(row.id);
                setShowList(false);
              }}
            >
              <span>{row.serial || row.id.slice(0, 8)}</span>
              <span>{row.isPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL}</span>
            </button>
          ))}
        </div>
      </DocumentBrowseDrawer>
      <FormSectionCard title="بيانات التسوية" subtitle="المخزن والتاريخ والفلاتر">
          <CompactFormField
            label="المسلسل"
            placeholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل رقم المسلسل'}
            readOnly={serialAutomatic}
            {...register('serialNumber')}
          />
          <CompactFormField
            label="التاريخ"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
          <div data-tour-id="stocktaking-warehouse-select">
            <CompactFormField label="المخزن" error={errors.warehouseId?.message}>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <WarehouseSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    className={`${inputCls} ${errors.warehouseId ? 'border-red-400' : ''}`}
                    emptyLabel="اختر المخزن"
                  />
                )}
              />
            </CompactFormField>
          </div>
          <CompactFormField label="المجموعة">
            <ItemGroupSelect
              value={filterItemGroupId}
              onChange={setFilterItemGroupId}
              groups={itemGroups}
              emptyLabel="كل المجموعات"
            />
          </CompactFormField>
          <CompactFormField label="الصنف">
            <ItemSelect
              value={filterItemId}
              onChange={setFilterItemId}
              allowEmpty
              emptyLabel="كل الأصناف"
            />
          </CompactFormField>
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="col-span-full flex flex-wrap items-end gap-4 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3">
            <div>
              <p className={labelCls}>نطاق التحميل</p>
              <Controller
                name="loadScope"
                control={control}
                render={({ field }) => (
                  <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-[#094C6B]">
                    {(
                      [
                        ['all', 'كل الأصناف'],
                        ['withBalance', 'لها رصيد فقط'],
                        ['negativeOnly', 'السالبة فقط'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="loadScope"
                          checked={field.value === value}
                          onChange={() => field.onChange(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
            <button
              type="button"
              disabled={refreshing || isPosted}
              onClick={() => void handleRefreshStock()}
              className="h-9 px-4 rounded-lg border border-[#0E78AA] bg-[#0E78AA] text-sm font-semibold text-white disabled:opacity-50"
              data-tour-id="stocktaking-save-btn"
            >
              {refreshing ? 'جاري التحميل…' : 'تحديث الجرد'}
            </button>
          </div>
      </FormSectionCard>

      <FormSectionCard title="فروقات الجرد" subtitle="جدول إدخال — الكمية الفعلية تُحسب منها العجز/الزيادة وتُرسل مع الحفظ" bodyClassName="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="gap-2"
              onClick={() =>
                setStocktakingLines([
                  ...stocktakingLines,
                  lineFromQuantities('', 0, 0, 0, 0),
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              إضافة صنف
            </Button>
          </div>
          <div className={denseTableWrapClass} data-tour-id="stocktaking-items-table">
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>م</th>
                  <th className={denseThClass}>الصنف</th>
                  <th className={denseThClass}>الموجود بالمخزن</th>
                  <th className={denseThClass}>القيمة الدفترية</th>
                  <th className={denseThClass}>الكمية الفعلية</th>
                  <th className={denseThClass}>العجز</th>
                  <th className={denseThClass}>الزيادة</th>
                  <th className={denseThClass}>متوسط التكلفة</th>
                  <th className={denseThClass}>قيمة العجز</th>
                  <th className={denseThClass}>قيمة الزيادة</th>
                  <th className={denseThClass}> </th>
                </tr>
              </thead>
              <tbody>
                {stocktakingLines.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-sm text-slate-500">
                      لا توجد بنود جرد — أضف صنفاً وأدخل الكمية الفعلية قبل الحفظ.
                    </td>
                  </tr>
                ) : (
                  stocktakingLines.map((line, i) => (
                    <tr key={`st-${i}`} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">{i + 1}</td>
                      <td className="min-w-[12rem] py-1.5 px-2 border-x border-[#D6EAF3]">
                        <ItemSelect
                          value={line.itemId}
                          onChange={(id) => {
                            const next = [...stocktakingLines];
                            next[i] = { ...next[i], itemId: id };
                            setStocktakingLines(next);
                            if (id) void applyWarehouseBookToLine(id, i);
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3] text-center">
                        <InvoiceLineStockBalanceCell
                          itemId={line.itemId}
                          warehouseId={warehouseId}
                          displayMode="onHand"
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <TableNumberInput
                          className={inputCls}
                          value={line.bookValue}
                          onValueCommit={(bookValue) => {
                            const actualValue = stocktakingLines[i].actualValue;
                            const next = [...stocktakingLines];
                            next[i] = lineFromQuantities(
                              next[i].itemId,
                              bookValue,
                              actualValue,
                              next[i].averageUnitCost,
                              next[i].unitPrice
                            );
                            void applySurplusUnitPricesFromList(surplusPriceListId, next).then(
                              setStocktakingLines
                            );
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <TableNumberInput
                          className={inputCls}
                          value={line.actualValue}
                          onValueCommit={(actualValue) => {
                            const bookValue = stocktakingLines[i].bookValue;
                            const next = [...stocktakingLines];
                            next[i] = lineFromQuantities(
                              next[i].itemId,
                              bookValue,
                              actualValue,
                              next[i].averageUnitCost,
                              next[i].unitPrice
                            );
                            void applySurplusUnitPricesFromList(surplusPriceListId, next).then(
                              setStocktakingLines
                            );
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input className={inputCls} value={line.shortage} readOnly />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input className={inputCls} value={line.surplus} readOnly />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input
                          className={`${inputCls} bg-slate-50 text-slate-600`}
                          value={formatMoneyAr(line.averageUnitCost || line.unitPrice)}
                          readOnly
                          title="متوسط التكلفة من رصيد المخزن"
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input
                          className={inputCls}
                          value={formatMoneyAr(line.shortage * (line.averageUnitCost || line.unitPrice))}
                          readOnly
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input
                          className={inputCls}
                          value={formatMoneyAr(line.surplus * line.unitPrice)}
                          readOnly
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <IconButton
                          icon={Trash2}
                          label="حذف السطر"
                          variant="danger"
                          onClick={() => setStocktakingLines(stocktakingLines.filter((_, idx) => idx !== i))}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </FormSectionCard>

      <FormSectionCard title="الإجمالي والتسعير" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <CompactFormField label="إجمالى الزيادة" value={formatMoneyAr(stockTotals.surplus)} readOnly />
          <CompactFormField label="إجمالى العجز" value={formatMoneyAr(stockTotals.shortage)} readOnly />
          <CompactFormField label="تسعير الزيادة">
            <select
              className={inputCls}
              value={surplusPriceListId}
              disabled={isPosted}
              onChange={(e) => {
                const id = e.target.value;
                setSurplusPriceListId(id);
                void applySurplusUnitPricesFromList(id, stocktakingLines).then(setStocktakingLines);
              }}
            >
              <option value="">متوسط التكلفة (افتراضي)</option>
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.code ? `${pl.code} — ` : ''}
                  {pl.arabicName}
                </option>
              ))}
            </select>
          </CompactFormField>
          <div className="flex flex-wrap items-end gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleImportExcel(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={sheetBusy || isPosted}
              onClick={() => excelInputRef.current?.click()}
            >
              {sheetBusy ? 'جاري الاستيراد…' : 'استيراد Excel'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!stocktakingLines.some((l) => l.itemId)}
              onClick={() => void handleExportExcel()}
            >
              تصدير Excel
            </Button>
          </div>
      </FormSectionCard>

      <FormStickyFooter
        status={`${stocktakingLines.length} بند · زيادة ${formatMoneyAr(stockTotals.surplus)} · عجز ${formatMoneyAr(stockTotals.shortage)}`}
      />

      <StockMovementBottomSplit
        totalAmount={stockTotals.surplus + stockTotals.shortage}
        lineCount={stocktakingLines.filter((l) => l.itemId).length}
        {...stockPanel.bottomSplitProps}
      />
    </ErpDocumentLayout>
  );
}
