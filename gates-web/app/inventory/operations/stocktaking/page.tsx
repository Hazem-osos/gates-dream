'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErpDocumentLayout, ErpDocumentPageHeader, PageDraftRestoreGate } from '@/components/erp';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import { confirmAction } from '@/lib/feedback/confirm';
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
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import { StocktakingGlAccountsDrawer } from '@/components/inventory/stock/StocktakingGlAccountsDrawer';
import { ItemGroupSelect } from '@/app/components/form/ItemGroupSelect';
import { ColumnResizeHandle } from '@/components/grid/ColumnResizeHandle';
import { ResizableColGroup } from '@/components/grid/ResizableColGroup';
import { useResizableColumns } from '@/components/grid/useResizableColumns';
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
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';

import { formatMoneyAr } from '@/lib/formatMoney';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { isUnsetOrDefaultWarehouse } from '@/lib/drafts/form-lines-draft';
import { pinDocumentTabQuery } from '@/lib/navigation/tab-memory';
import { printStockDocument } from '@/lib/print/printStockDocument';
import { maybePrintStockDocumentAfterSave } from '@/lib/inventory/stock-document-print-after-save';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import {
  useApplyDefaultWarehouseFromTransactionSettings,
  useTransactionDocumentSettings,
} from '@/lib/transaction-settings/use-transaction-document-settings';
import {
  applyAsOfAverageCosts,
  applyLiveBookBalances,
  diffBookFromWarehouse,
  fetchWarehouseBalanceMap,
  formatStocktakingDriftMessage,
  STOCKTAKING_QTY_EPS,
  warehouseBalanceMapFromRows,
} from '@/lib/inventory/stocktaking-balance-sync';
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/lib/datetime/local-datetime';

/** قيمة حقل «تسعير الزيادة» — فارغ = متوسط التكلفة */
const STOCKTAKING_SURPLUS_PRICING_ITEM_PURCHASE = '__item_purchase__';

const STOCKTAKING_LINE_COLUMN_IDS = [
  'seq',
  'item',
  'bookQty',
  'actualQty',
  'shortage',
  'surplus',
  'avgCost',
  'shortageVal',
  'surplusVal',
  'actions',
] as const;

const STOCKTAKING_LINE_DEFAULT_WIDTHS: Record<string, number> = {
  seq: 44,
  item: 220,
  bookQty: 92,
  actualQty: 92,
  shortage: 72,
  surplus: 72,
  avgCost: 100,
  shortageVal: 100,
  surplusVal: 100,
  actions: 52,
};

type StocktakingPricingCatalogItem = {
  id: string;
  averageCost?: number | string | null;
  lastPurchasePrice?: number | string | null;
  itemPrices?: Array<{
    purchasePrice?: number | string | null;
    retailPrice?: number | string | null;
    price?: number | string | null;
    priceList?: { id?: string; priceMode?: string | null; isActive?: boolean | null };
  }>;
};

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

function emptyStocktakingDefaults(): InventoryStocktakingPageFormInput {
  return {
    serialNumber: '',
    description: '',
    date: toDatetimeLocalValue(),
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

type StocktakingDraft = {
  form: InventoryStocktakingPageFormInput;
  lines: StocktakingLine[];
  surplusPricingMode: string;
  filterItemGroupId: string;
  filterItemId: string;
};

function isStocktakingDraftEmpty(
  draft: StocktakingDraft,
  defaultWarehouseId?: string | null,
): boolean {
  const form = draft.form;
  const hasHeader =
    Boolean(form.serialNumber?.trim()) ||
    Boolean(form.description?.trim()) ||
    !isUnsetOrDefaultWarehouse(form.warehouseId, defaultWarehouseId);
  const hasLines = (draft.lines ?? []).some((line) => line.itemId);
  return !hasHeader && !hasLines;
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

function StocktakingPageContent() {
  const { unlockForEdit, lockToView, isReadOnly } = useDocumentMode();
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();

  const inputCls = compactControlClass;
  const numInputCls = `${inputCls} w-full min-w-0 px-1.5 py-1 text-center text-xs`;
  const { startResize: startStocktakingColResize, colGroup: stocktakingColGroup } = useResizableColumns(
    [...STOCKTAKING_LINE_COLUMN_IDS],
    {
      storageKey: 'gates-cols:inventory-stocktaking-lines',
      minWidth: 48,
      defaultWidth: 88,
      defaultWidths: STOCKTAKING_LINE_DEFAULT_WIDTHS,
    }
  );
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
    defaultValues: emptyStocktakingDefaults(),
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
  const [refreshing, setRefreshing] = useState(false);
  const [balancesBusy, setBalancesBusy] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [filterItemGroupId, setFilterItemGroupId] = useState('');
  const [filterItemId, setFilterItemId] = useState('');
  const [surplusPricingMode, setSurplusPricingMode] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unpostPending, setUnpostPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const skipServerHydrateRef = useRef(false);
  const stocktakingLinesRef = useRef<StocktakingLine[]>([]);
  stocktakingLinesRef.current = stocktakingLines;
  const openStocktaking = useCallback((id: string | null) => {
    setDocumentId(id);
    pinDocumentTabQuery(id);
  }, []);
  const watchedForm = watch();
  const draftSnapshot = useMemo<StocktakingDraft>(
    () => ({
      form: watchedForm,
      lines: stocktakingLines,
      surplusPricingMode,
      filterItemGroupId,
      filterItemId,
    }),
    [watchedForm, stocktakingLines, surplusPricingMode, filterItemGroupId, filterItemId]
  );
  const applyStocktakingDraft = useCallback((payload: StocktakingDraft) => {
    skipServerHydrateRef.current = true;
    reset({ ...emptyStocktakingDefaults(), ...payload.form });
    setStocktakingLines(Array.isArray(payload.lines) ? payload.lines : []);
    setSurplusPricingMode(payload.surplusPricingMode ?? '');
    setFilterItemGroupId(payload.filterItemGroupId ?? '');
    setFilterItemId(payload.filterItemId ?? '');
  }, [reset]);
  const {
    autoPostOnSave,
    autoPrintOnSave,
    saveLabel: settingsSaveLabel,
    defaultWarehouseId: txDefaultWarehouseId,
  } = useTransactionDocumentSettings('STOCK_STOCKTAKING');
  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'stocktaking',
    mode: documentId ? 'edit' : 'new',
    documentId,
    value: draftSnapshot,
    enabled: !isPosted,
    applyRestore: applyStocktakingDraft,
    isEmpty: (draft) => isStocktakingDraftEmpty(draft, txDefaultWarehouseId),
    restoreMessage: 'تم استعادة مسودة تسوية الجرد',
  });

  useEffect(() => {
    const id = searchParams.get('id')?.trim() || null;
    setDocumentId((prev) => (prev === id ? prev : id));
  }, [searchParams]);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const warehouseId = watch('warehouseId');
  const documentDate = watch('date');
  const loadScope = watch('loadScope');

  const hasFilledLines = stocktakingLines.some((line) => line.itemId);
  const { data: liveWarehouseQtyRes, refetch: refetchLiveWarehouseQty } = useApiQuery<
    {
      itemId?: string;
      quantity?: number | string;
      quantityOnHand?: number | string;
      averageCost?: number | string;
      item?: { averageCost?: unknown; lastPurchasePrice?: unknown };
    }[]
  >(
    ['stocktaking-live-wh', warehouseId ?? 'none', documentDate ?? ''],
    warehouseId ? `/inventory/item-quantities/warehouse/${warehouseId}` : '/inventory/item-quantities',
    documentDate ? { date: String(documentDate).slice(0, 10) } : undefined,
    { enabled: Boolean(warehouseId) && hasFilledLines, staleTime: 20_000 }
  );
  const liveBalanceByItem = useMemo(
    () => warehouseBalanceMapFromRows(liveWarehouseQtyRes?.data ?? []),
    [liveWarehouseQtyRes?.data]
  );

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

  const stocktakingSaveLabel = autoPostOnSave ? 'حفظ وتسوية الجرد' : settingsSaveLabel;

  useApplyDefaultWarehouseFromTransactionSettings({
    selectedId: documentId,
    warehouseId,
    defaultWarehouseId: txDefaultWarehouseId,
    setWarehouseId: (id) => setValue('warehouseId', id, { shouldDirty: false }),
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
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    const row = stocktakingDetail?.data;
    if (!row || row.id !== documentId || hydratedIdRef.current === row.id) return;
    hydratedIdRef.current = row.id;
    reset({
      ...emptyStocktakingDefaults(),
      serialNumber: row.serial ?? '',
      description: row.description ?? '',
      date: row.date ? toDatetimeLocalValue(String(row.date)) : toDatetimeLocalValue(),
      hijriDate: row.hijriDate ?? '',
      warehouseId: row.warehouseId ?? '',
      isPosted: Boolean(row.isPosted),
      isApproved: Boolean(row.isApproved),
    });
    if (row.isPosted) lockToView();
    else unlockForEdit();
    setStocktakingLines(
      (row.lines ?? []).map((line) => {
        const bookValue = Number(line.bookQuantity || 0);
        const actualValue = Number(line.actualQuantity || 0);
        const unitPrice = Number(line.unitPrice || 0);
        return lineFromQuantities(line.itemId, bookValue, actualValue, unitPrice, unitPrice);
      })
    );
  }, [stocktakingDetail, documentId, reset, lockToView, unlockForEdit]);

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

  const stocktakingFinancialRows = useMemo(
    () => [
      {
        label: 'زيادة المخزون',
        value: stockTotals.surplus > 0 ? -stockTotals.surplus : 0,
        show: stockTotals.surplus > 0,
      },
      {
        label: 'عجز المخزون',
        value: stockTotals.shortage,
        show: stockTotals.shortage > 0,
      },
    ],
    [stockTotals]
  );

  const stocktakingNetAmount = useMemo(
    () => stockTotals.shortage - stockTotals.surplus,
    [stockTotals]
  );

  const postAfterSaveRef = useRef(false);
  const [postPending, setPostPending] = useState(false);

  const applyPostSuccess = useCallback(
    (res: ApiResponse<unknown>, savedId: string) => {
      setSuccess(postSuccessMessage(res));
      setValue('isPosted', true);
      lockToView();
      stockPanel.onPosted(res);
      invalidateStockViews(invalidateQuery);
      invalidateQuery(['stocktaking', savedId]);
      hydratedIdRef.current = null;
    },
    [invalidateQuery, setValue, stockPanel, lockToView]
  );

  const clearStocktakingForNext = () => {
    clearDraft();
    openStocktaking(null);
    stockPanel.resetPanel();
    setStocktakingLines([]);
    setFilterItemGroupId('');
    setFilterItemId('');
    setSurplusPricingMode('');
    reset(emptyStocktakingDefaults());
    setSourceBarKey((k) => k + 1);
  };

  const finishSavedStocktaking = useCallback(
    (args: { number?: string; savedId?: string; posted?: boolean }) => {
      maybePrintStockDocumentAfterSave(autoPrintOnSave, {
        title: 'تسوية الجرد المخزني',
        number: args.number || watch('serialNumber'),
        date: watch('date'),
        rows: stocktakingLines
          .filter((line) => line.itemId)
          .map((line) => ({
            item: line.itemId,
            quantity: line.actualValue,
            price: line.unitPrice,
          })),
      });
      finishDocumentSave({
        label: 'تسوية الجرد المخزني',
        number: args.number,
        posted: args.posted,
        savedId: args.savedId,
        onOpen: (saved) => openStocktaking(saved),
        onSavedOpen: (saved) => invalidateQuery(['stocktaking', saved]),
        reset: clearStocktakingForNext,
      });
      dispatchAcademyTrigger('API_SUCCESS', 'stocktaking.save-success');
    },
    [autoPrintOnSave, invalidateQuery, stocktakingLines, watch]
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
    reset((prev) => ({ ...prev, date: prev.date || toDatetimeLocalValue() }));
  }, [reset]);

  const handleNew = () => {
    setError('');
    setSuccess('');
    clearStocktakingForNext();
  };

  const handleUnpost = async () => {
    if (!documentId) {
      setError('احفظ التسوية أولاً');
      return;
    }
    setError('');
    setUnpostPending(true);
    try {
      await apiClient.post(`/inventory/stocktaking/${documentId}/unpost`);
      setValue('isPosted', false);
      setSuccess('تم فك التسوية — يمكنك التعديل أو الإلغاء');
      stockPanel.resetPanel();
      unlockForEdit();
      invalidateQuery(['stocktaking', documentId]);
      invalidateStockViews(invalidateQuery);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر فك التسوية');
    } finally {
      setUnpostPending(false);
    }
  };

  const handleCancelStocktaking = async () => {
    if (!documentId) {
      handleNew();
      return;
    }
    if (isPosted) {
      setError('فك التسوية أولاً قبل الإلغاء');
      return;
    }
    if (!(await confirmAction('إلغاء تسوية الجرد هذه؟'))) return;
    setCancelPending(true);
    setError('');
    try {
      await apiClient.post(`/inventory/stocktaking/${documentId}/cancel`, {});
      setSuccess('تم إلغاء التسوية');
      invalidateQuery(['stocktaking', documentId]);
      invalidateQuery(['stocktaking-list']);
      lockToView();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء التسوية');
    } finally {
      setCancelPending(false);
    }
  };

  const handleRestoreStocktaking = async () => {
    if (!documentId || restorePending) return;
    setRestorePending(true);
    setError('');
    try {
      await restoreCancelledDocument({
        restorePath: `/inventory/stocktaking/${documentId}/restore`,
        postPath: `/inventory/stocktaking/${documentId}/post`,
        kind: 'named',
        autoPostOnSave,
      });
      setSuccess(
        autoPostOnSave ? 'تمت الاستعادة والتسوية' : 'تمت الاستعادة — المستند غير مرحّل'
      );
      invalidateQuery(['stocktaking', documentId]);
      invalidateQuery(['stocktaking-list']);
      if (autoPostOnSave) lockToView();
      else unlockForEdit();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الاستعادة');
    } finally {
      setRestorePending(false);
    }
  };

  const applyWarehouseBookToLine = useCallback(
    async (itemId: string, index: number, keepActualIfSet?: boolean) => {
      if (!warehouseId || !itemId) return;
      try {
        const res = await apiClient.get<{
          quantityOnHand?: number;
          averageCost?: number;
        }>(`/inventory/items/${itemId}/stock-balance`, {
          warehouseId,
          ...(documentDate ? { date: String(documentDate).slice(0, 10) } : {}),
        });
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
    [warehouseId, documentDate]
  );

  useEffect(() => {
    if (!warehouseId || isPosted || isReadOnly) return;
    const rows = stocktakingLinesRef.current.filter((line) => line.itemId);
    if (!rows.length) return;
    let cancelled = false;
    void fetchWarehouseBalanceMap(warehouseId, documentDate).then((liveMap) => {
      if (cancelled) return;
      setStocktakingLines((prev) => applyAsOfAverageCosts(prev, liveMap));
    });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, documentDate, isPosted, isReadOnly]);

  const applySurplusPricing = useCallback(async (mode: string, lines: StocktakingLine[]) => {
    const useAverage = !mode.trim();
    const catalog: StocktakingPricingCatalogItem[] = useAverage
      ? []
      : ((await apiClient.get<StocktakingPricingCatalogItem[]>('/inventory/items', {
          limit: 2000,
          isActive: true,
        })).data ?? []);

    return lines.map((line) => {
      const fallback = line.averageUnitCost || line.unitPrice;
      if (!line.itemId || line.surplus <= 0) {
        return { ...line, unitPrice: fallback };
      }
      if (useAverage) {
        return { ...line, unitPrice: fallback };
      }
      const item = catalog.find((row) => row.id === line.itemId);
      if (mode === STOCKTAKING_SURPLUS_PRICING_ITEM_PURCHASE) {
        const purchase = Number(item?.lastPurchasePrice ?? 0);
        return { ...line, unitPrice: purchase > 0 ? purchase : fallback };
      }
      const listPrice = item
        ? resolvePriceListPurchasePrice(
            item as Parameters<typeof resolvePriceListPurchasePrice>[0],
            mode
          )
        : 0;
      return { ...line, unitPrice: listPrice > 0 ? listPrice : fallback };
    });
  }, []);

  const loadItemCatalogForLabels = useCallback(async () => {
    const res = await apiClient.get<
      { id: string; code?: string; serial?: string; arabicName?: string }[]
    >('/inventory/items', { limit: 2000, isActive: true });
    return res.data ?? [];
  }, []);

  const handleUpdateBookBalances = async () => {
    setError('');
    setSuccess('');
    if (!warehouseId) {
      setError('يرجى اختيار المخزن أولاً');
      return;
    }
    const filled = stocktakingLines.filter((line) => line.itemId);
    if (!filled.length) {
      setError('لا توجد أصناف لتحديث أرصدتها');
      return;
    }
    setBalancesBusy(true);
    try {
      const liveMap = await fetchWarehouseBalanceMap(warehouseId, documentDate);
      const driftsBefore = diffBookFromWarehouse(filled, liveMap);
      const { lines: synced, updatedCount } = applyLiveBookBalances(stocktakingLines, liveMap, {
        keepActual: true,
      });
      const next = await applySurplusPricing(surplusPricingMode, synced);
      setStocktakingLines(next);
      void refetchLiveWarehouseQty();
      if (driftsBefore.length === 0) {
        setSuccess('الرصيد الدفتري على الشاشة مطابق لرصيد المخزن');
        return;
      }
      const catalog = await loadItemCatalogForLabels();
      const detail = formatStocktakingDriftMessage(driftsBefore, catalog, 8);
      setSuccess(
        updatedCount > 0
          ? `تم تحديث الرصيد الدفتري لـ ${updatedCount} صنف من المخزن الحالي`
          : 'تمت المزامنة'
      );
      toast.warning(`تم تصحيح فروق سابقة بين الدفتري والمخزن:\n${detail}`, {
        duration: 10_000,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الأرصدة من المخزن');
    } finally {
      setBalancesBusy(false);
    }
  };

  const handleVerifyBookBalances = async () => {
    setError('');
    setSuccess('');
    if (!warehouseId) {
      setError('يرجى اختيار المخزن أولاً');
      return;
    }
    const filled = stocktakingLines.filter((line) => line.itemId);
    if (!filled.length) {
      setError('لا توجد أصناف للفحص');
      return;
    }
    setBalancesBusy(true);
    try {
      const liveMap =
        liveBalanceByItem.size > 0
          ? liveBalanceByItem
          : await fetchWarehouseBalanceMap(warehouseId, documentDate);
      const drifts = diffBookFromWarehouse(filled, liveMap);
      if (!drifts.length) {
        setSuccess('كل الأرصدة الدفترية مطابقة للموجود بالمخزن');
        return;
      }
      const catalog = await loadItemCatalogForLabels();
      const msg = formatStocktakingDriftMessage(drifts, catalog);
      setError(
        `الرصيد الدفتري على الشاشة لا يطابق المخزن في ${drifts.length} صنف:\n${msg}\nاستخدم «تحديث الأرصدة» لمزامنة الدفتري من المخزن قبل الحفظ.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر فحص مطابقة الأرصدة');
    } finally {
      setBalancesBusy(false);
    }
  };

  const handleRefreshStock = async () => {
    setError('');
    setSuccess('');
    if (!warehouseId) {
      setError('يرجى اختيار المخزن أولاً');
      return;
    }
    setRefreshing(true);
    try {
      const qtyParams = new URLSearchParams();
      if (filterItemId) qtyParams.set('itemId', filterItemId);
      if (documentDate) qtyParams.set('date', String(documentDate).slice(0, 10));
      const query = qtyParams.toString() ? `?${qtyParams.toString()}` : '';
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
      next = await applySurplusPricing(surplusPricingMode, next);
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
      next = await applySurplusPricing(surplusPricingMode, next);
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
    void handleSubmit(async (values) => {
      setError('');
      setSuccess('');
      if (values.isPosted) {
        postAfterSaveRef.current = false;
        setError('لا يمكن تعديل جرد مرحّل');
        return;
      }
      if (!values.warehouseId) {
        postAfterSaveRef.current = false;
        setError('يرجى اختيار المخزن');
        return;
      }
      let linesForSave = stocktakingLines.filter((line) => line.itemId);
      if (linesForSave.length === 0) {
        postAfterSaveRef.current = false;
        setError('يرجى إضافة أصناف لتسوية الجرد');
        return;
      }

      const liveMap = await fetchWarehouseBalanceMap(values.warehouseId, values.date);
      const drifts = diffBookFromWarehouse(linesForSave, liveMap);
      if (drifts.length > 0) {
        const catalog = await loadItemCatalogForLabels();
        const driftMsg = formatStocktakingDriftMessage(drifts, catalog);
        const syncAndSave = await confirmAction({
          title: 'فرق بين الدفتري والمخزن',
          message:
            `لا يمكن الحفظ والرصيد الدفتري على الشاشة لا يطابق المخزن الحالي:\n\n${driftMsg}\n\nتحديث الأرصدة من المخزن (مع الإبقاء على الكمية الفعلية) ثم الحفظ؟`,
          confirmLabel: 'تحديث الأرصدة وحفظ',
          cancelLabel: 'إلغاء',
          tone: 'warning',
        });
        if (!syncAndSave) {
          postAfterSaveRef.current = false;
          setError(
            `تم إلغاء الحفظ — راجع الأصناف التالية أو اضغط «تحديث الأرصدة»:\n${driftMsg}`
          );
          return;
        }
        const { lines: synced } = applyLiveBookBalances(stocktakingLines, liveMap, {
          keepActual: true,
        });
        linesForSave = (await applySurplusPricing(surplusPricingMode, synced)).filter(
          (line) => line.itemId
        );
        setStocktakingLines(linesForSave);
        void refetchLiveWarehouseQty();
      }

      const payload = {
        serial: values.serialNumber || undefined,
        description: values.description,
        date: datetimeLocalToIso(values.date),
        hijriDate: values.hijriDate || undefined,
        warehouseId: values.warehouseId,
        lines: linesForSave.map((line) => ({
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
      <PageDraftRestoreGate<StocktakingDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(documentId)}
        message="يوجد مسودة تسوية جرد غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyStocktakingDraft(payload);
          setSuccess('تم استعادة مسودة التسوية');
        }}
      />

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'تسوية الجرد المخزني' },
        ]}
        title="تسوية الجرد المخزني"
        docNumber={watch('serialNumber') || ''}
        lifecycle={{
          documentId,
          isPosted,
          isCancelled: Boolean(
            (stocktakingDetail?.data as { isCancelled?: boolean } | undefined)?.isCancelled
          ),
        }}
        saveLabel={stocktakingSaveLabel}
        onSaveDraft={() => {
          postAfterSaveRef.current = autoPostOnSave;
          handleSave();
        }}
        savePending={loading}
        canSave={!loading && !isPosted && !isReadOnly}
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
          hasDocument: Boolean(documentId),
          isPosted: Boolean(isPosted),
          isCancelled: Boolean(
            (stocktakingDetail?.data as { isCancelled?: boolean } | undefined)?.isCancelled
          ),
          onRestore: () => void handleRestoreStocktaking(),
          restoreLabel: 'استعادة',
          restorePending,
          onPost: () => {
            postAfterSaveRef.current = true;
            handleSave();
          },
          postLabel: 'تسوية الجرد',
          postPending,
          onUnpost: () => void handleUnpost(),
          unpostLabel: 'فك التسوية',
          unpostPending,
          onEdit: () => {
            if (isPosted) {
              setError('فك التسوية أولاً من قائمة (...) ثم عدّل');
              return;
            }
            unlockForEdit();
          },
          onVoid: () => void handleCancelStocktaking(),
          voidLabel: 'إلغاء التسوية',
          voidPending: cancelPending,
          voidLockedHint: 'فك التسوية أولاً ثم ألغِ المستند من قائمة (...)',
          onNew: handleNew,
          newLabel: 'جديد',
          transactionSettingsDocumentType: 'STOCK_STOCKTAKING',
          onTransactionSettingsSaved: () => {
            invalidateAfterTransactionSettingsSave(invalidateQuery, 'STOCK_STOCKTAKING');
            void invalidateNextSerial();
          },
          onPrint: () =>
            printStockDocument({
              title: 'تسوية الجرد المخزني',
              number: watch('serialNumber'),
              date: watch('date'),
              rows: stocktakingLines
                .filter((line) => line.itemId)
                .map((line) => ({
                  item: line.itemId,
                  quantity: line.actualValue,
                  price: line.unitPrice,
                })),
            }),
          printLabel: 'طباعة',
          extraItems: [
            {
              id: 'stocktaking-gl-settings',
              label: 'إعدادات حسابات التسوية',
              onClick: () => setSettingsOpen(true),
            },
          ],
        }}
      />
      <DocumentReadOnlyBanner />
      <StocktakingGlAccountsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
      <DocumentFormLock>
      <FormSectionCard
        title="بيانات التسوية"
        subtitle="المخزن والتاريخ والفلاتر"
        sourceActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={stocktakingLines.some((l) => Boolean(l.itemId))}
            disabled={Boolean(isPosted)}
            currentAffectsStock
            onHydrate={handleSourceHydrate}
          />
        }
      >
          <CompactFormField
            label="المسلسل"
            placeholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل رقم المسلسل'}
            readOnly={serialAutomatic}
            {...register('serialNumber')}
          />
          <CompactFormField
            label="التاريخ"
            type="datetime-local"
            step="1"
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
              {refreshing ? 'جاري التحميل…' : 'تحميل أصناف المخزن'}
            </button>
          </div>
      </FormSectionCard>

      <FormSectionCard
        title="فروقات الجرد"
        subtitle="الدفتري = أساس التسوية (حدّثه من «تحديث الأرصدة») · الفعلي = العدّ — العجز/الزيادة تُحسب تلقائياً"
        bodyClassName="space-y-3"
      >
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={balancesBusy || isPosted || !warehouseId}
              onClick={() => void handleVerifyBookBalances()}
            >
              {balancesBusy ? 'جاري الفحص…' : 'فحص مطابقة الأرصدة'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={balancesBusy || isPosted || !warehouseId}
              onClick={() => void handleUpdateBookBalances()}
            >
              {balancesBusy ? 'جاري التحديث…' : 'تحديث الأرصدة'}
            </Button>
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
            <table className={`${denseTableClass} w-full table-fixed`}>
              <ResizableColGroup columns={stocktakingColGroup} />
              <thead className={denseTheadClass}>
                <tr>
                  {(
                    [
                      ['seq', 'م'],
                      ['item', 'الصنف'],
                      ['bookQty', 'الكمية الدفترية'],
                      ['actualQty', 'الكمية الفعلية'],
                      ['shortage', 'العجز'],
                      ['surplus', 'الزيادة'],
                      ['avgCost', 'متوسط التكلفة'],
                      ['shortageVal', 'قيمة العجز'],
                      ['surplusVal', 'قيمة الزيادة'],
                      ['actions', ''],
                    ] as const
                  ).map(([id, label]) => (
                    <th key={id} className={`${denseThClass} relative`}>
                      {label}
                      <ColumnResizeHandle
                        onMouseDown={(event) => startStocktakingColResize(id, event)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocktakingLines.length === 0 ? (
                  <tr>
                    <td colSpan={STOCKTAKING_LINE_COLUMN_IDS.length} className="py-6 text-sm text-slate-500">
                      لا توجد بنود جرد — أضف صنفاً وأدخل الكمية الفعلية قبل الحفظ.
                    </td>
                  </tr>
                ) : (
                  stocktakingLines.map((line, i) => {
                    const liveQty = line.itemId
                      ? liveBalanceByItem.get(line.itemId)?.quantityOnHand
                      : undefined;
                    const bookDrift =
                      line.itemId &&
                      liveQty != null &&
                      Math.abs(line.bookValue - liveQty) > STOCKTAKING_QTY_EPS;
                    return (
                    <tr key={`st-${i}`} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3] text-center text-xs">
                        {i + 1}
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3] overflow-hidden">
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
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        {bookDrift ? (
                          <p className="mb-0.5 text-[10px] font-semibold leading-tight text-amber-800">
                            ≠ المخزن
                          </p>
                        ) : null}
                        <TableNumberInput
                          className={`${numInputCls}${bookDrift ? ' border-amber-400 ring-1 ring-amber-200' : ''}`}
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
                            void applySurplusPricing(surplusPricingMode, next).then(
                              setStocktakingLines
                            );
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        <TableNumberInput
                          className={numInputCls}
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
                            void applySurplusPricing(surplusPricingMode, next).then(
                              setStocktakingLines
                            );
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        <input className={numInputCls} value={line.shortage} readOnly />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        <input className={numInputCls} value={line.surplus} readOnly />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        <input
                          className={`${numInputCls} bg-slate-50 text-slate-600`}
                          value={formatMoneyAr(line.averageUnitCost || line.unitPrice)}
                          readOnly
                          title="متوسط التكلفة من رصيد المخزن"
                        />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        <input
                          className={numInputCls}
                          value={formatMoneyAr(line.shortage * (line.averageUnitCost || line.unitPrice))}
                          readOnly
                        />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3]">
                        <input
                          className={numInputCls}
                          value={formatMoneyAr(line.surplus * line.unitPrice)}
                          readOnly
                        />
                      </td>
                      <td className="py-1.5 px-1 border-x border-[#D6EAF3] text-center">
                        <IconButton
                          icon={Trash2}
                          label="حذف السطر"
                          variant="danger"
                          onClick={() => setStocktakingLines(stocktakingLines.filter((_, idx) => idx !== i))}
                        />
                      </td>
                    </tr>
                    );
                  })
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
              value={surplusPricingMode}
              disabled={isPosted}
              onChange={(e) => {
                const mode = e.target.value;
                setSurplusPricingMode(mode);
                void applySurplusPricing(mode, stocktakingLines).then(setStocktakingLines);
              }}
            >
              <option value="">متوسط التكلفة (افتراضي)</option>
              <option value={STOCKTAKING_SURPLUS_PRICING_ITEM_PURCHASE}>سعر شراء الصنف</option>
              {priceLists.length ? (
                <optgroup label="سعر شراء من قوائم الأسعار">
                  {priceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.code ? `${pl.code} · ` : ''}
                      {pl.arabicName}
                    </option>
                  ))}
                </optgroup>
              ) : null}
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
      </DocumentFormLock>

      <FormStickyFooter
        status={`${stocktakingLines.length} بند · زيادة ${formatMoneyAr(stockTotals.surplus)} · عجز ${formatMoneyAr(stockTotals.shortage)}`}
      />

      <StockMovementBottomSplit
        totalAmount={stocktakingNetAmount}
        netLabel="صافي التسوية"
        financialRows={stocktakingFinancialRows}
        lineCount={stocktakingLines.filter((l) => l.itemId).length}
        {...stockPanel.bottomSplitProps}
      />
    </ErpDocumentLayout>
  );
}

export default function StocktakingPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <StocktakingPageContent />
    </DocumentModeProvider>
  );
}
