'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { destinationAppTabHref, pinDocumentTabQuery } from '@/lib/navigation/tab-memory';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { ItemAssemblyHeader } from '@/components/inventory/assembly/ItemAssemblyHeader';
import { AssemblyLinesTable } from '@/components/inventory/assembly/AssemblyLinesTable';
import { AssemblyStickyFooter } from '@/components/inventory/assembly/AssemblyStickyFooter';
import {
  assemblyLineTotal,
  emptyAssemblyComponentLine,
  isEnteredAssemblyLine,
  type AssemblyComponentLine,
} from '@/components/inventory/assembly/assembly-line-types';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { useRepostAfterUnpost } from '@/lib/accounting/ensure-posted-after-save';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  extractStockPostResult,
  postSuccessMessage,
  useDocumentPostMutation,
} from '@/lib/inventory/use-document-post-mutation';
import type { ApiResponse } from '@/lib/api/types';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { printManufacturingVoucher } from '@/lib/print/printManufacturingVoucher';
import { maybeAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { useStoreDocumentSerial } from '@/lib/inventory/use-store-document-serial';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import {
  useApplyDefaultWarehouseFromTransactionSettings,
  useTransactionDocumentSettings,
} from '@/lib/transaction-settings/use-transaction-document-settings';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import type { AssemblyPricingMethod } from '@/lib/inventory/assembly-pricing';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { isUnsetOrDefaultWarehouse } from '@/lib/drafts/form-lines-draft';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { toast } from '@/lib/feedback/toast';
import {
  assemblySalesInvoiceDraftHref,
  storeAssemblySalesInvoiceDraft,
} from '@/lib/inventory/assembly-sales-invoice-draft';

type AssemblyParentItem = {
  id: string;
  serial?: string | null;
  arabicName: string;
  isAssembly?: boolean;
};

type BomExplosionResponse = {
  components: Array<{
    itemId: string;
    itemCode: string;
    itemNameAr: string;
    unit: { id: string; name: string } | null;
    availableQuantity: number;
    requiredQuantity: number;
    unitCost: number;
  }>;
};

type AssemblyRecord = {
  id: string;
  serial?: string | null;
  description?: string | null;
  date?: string;
  hijriDate?: string | null;
  warehouseId?: string;
  toWarehouseId?: string | null;
  costCenterId?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  journalEntryId?: string | null;
  record?: string | null;
  lines?: Array<{
    assembledItemId: string;
    assembledQuantity?: number | string;
    assembledItem?: { serial?: string | null; arabicName?: string };
    components?: Array<{
      componentItemId: string;
      quantity?: number | string;
      unitPrice?: number | string;
      componentItem?: { serial?: string | null; arabicName?: string };
    }>;
  }>;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

type AssemblyDraft = {
  serial: string;
  description: string;
  date: string;
  parentItemId: string;
  assemblyQuantity: number;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  costCenterId: string;
  pricingMethod: AssemblyPricingMethod;
  lines: AssemblyComponentLine[];
};

function isAssemblyDraftEmpty(
  draft: AssemblyDraft,
  defaultWarehouseId?: string | null,
): boolean {
  return (
    !draft.serial.trim() &&
    !draft.description.trim() &&
    !draft.parentItemId &&
    isUnsetOrDefaultWarehouse(draft.sourceWarehouseId, defaultWarehouseId) &&
    isUnsetOrDefaultWarehouse(draft.targetWarehouseId, defaultWarehouseId) &&
    !draft.costCenterId.trim() &&
    !draft.lines.some(isEnteredAssemblyLine)
  );
}

function AssemblyPageInner() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const {
    settings: assemblyTxSettings,
    autoPostOnSave,
    autoPrintOnSave,
    saveLabel: legacySaveLabel,
    defaultWarehouseId: txDefaultWarehouseId,
  } = useTransactionDocumentSettings('STOCK_ASSEMBLY');
  const assemblySaveLabel = autoPostOnSave ? 'حفظ وترحيل التجميع' : legacySaveLabel;
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost(
    autoPostOnSave
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restorePending, setRestorePending] = useState(false);
  const [explodePending, setExplodePending] = useState(false);
  const postAfterSaveRef = useRef(false);

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [parentItemId, setParentItemId] = useState('');
  const [assemblyQuantity, setAssemblyQuantity] = useState(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [glSkipped, setGlSkipped] = useState(false);
  const [lines, setLines] = useState<AssemblyComponentLine[]>([emptyAssemblyComponentLine()]);
  const [pricingMethod, setPricingMethod] = useState<AssemblyPricingMethod>('AVERAGE_COST');

  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'assembly',
    enabled: !selectedId,
    setSerial,
  });

  useApplyDefaultWarehouseFromTransactionSettings({
    selectedId,
    warehouseId: sourceWarehouseId,
    defaultWarehouseId: txDefaultWarehouseId,
    setWarehouseId: (id) => {
      setSourceWarehouseId(id);
      if (!targetWarehouseId) setTargetWarehouseId(id);
    },
  });

  const { data: itemsResponse } = useApiQuery<AssemblyParentItem[]>(
    ['items', 'assembly-parents'],
    '/inventory/items',
    { limit: 200, isActive: true, isAssembly: true }
  );
  const items = Array.isArray(itemsResponse?.data) ? itemsResponse.data : [];

  const { data: loadedResponse } = useApiQuery<AssemblyRecord>(
    ['assembly', selectedId ?? ''],
    selectedId ? `/inventory/assemblies/${selectedId}` : '/inventory/assemblies',
    undefined,
    { enabled: Boolean(selectedId) }
  );
  const loaded = loadedResponse?.data ?? null;

  useEffect(() => {
    const id = searchParams.get('id')?.trim();
    if (id && id !== selectedId) setSelectedId(id);
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!loaded || !selectedId) return;
    const first = loaded.lines?.[0];
    setSerial(loaded.serial || '');
    setDescription(loaded.description || '');
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    setParentItemId(first?.assembledItemId || '');
    setAssemblyQuantity(Number(first?.assembledQuantity) || 1);
    setSourceWarehouseId(loaded.warehouseId || '');
    setTargetWarehouseId(loaded.toWarehouseId || loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setIsPosted(resolvePostedFlag(loaded));
    setIsCancelled(Boolean(loaded.isCancelled));
    const je = loaded.journalEntryId || null;
    setJournalEntryId(je);
    setGlSkipped(resolvePostedFlag(loaded) && !je);
    setLines(
      (first?.components ?? []).map((comp) => ({
        itemId: comp.componentItemId,
        itemCode: comp.componentItem?.serial || '',
        itemName: comp.componentItem?.arabicName || '',
        unitId: '',
        unitName: '',
        availableQuantity: 0,
        quantity: Number(comp.quantity) || 0,
        unitCost: Number(comp.unitPrice) || 0,
        notes: '',
      }))
    );
  }, [loaded, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMode('create');
      return;
    }
    if (isCancelled || isPosted) lockToView();
    else setMode('edit');
  }, [isCancelled, isPosted, lockToView, selectedId, setMode]);

  const entered = useMemo(() => lines.filter(isEnteredAssemblyLine), [lines]);
  const totalComponentsCost = useMemo(
    () => entered.reduce((sum, line) => sum + assemblyLineTotal(line), 0),
    [entered]
  );
  const readOnly = isPosted || isCancelled || isReadOnly;

  const draftSnapshot = useMemo<AssemblyDraft>(
    () => ({
      serial,
      description,
      date,
      parentItemId,
      assemblyQuantity,
      sourceWarehouseId,
      targetWarehouseId,
      costCenterId,
      pricingMethod,
      lines,
    }),
    [
      serial,
      description,
      date,
      parentItemId,
      assemblyQuantity,
      sourceWarehouseId,
      targetWarehouseId,
      costCenterId,
      pricingMethod,
      lines,
    ]
  );

  const applyAssemblyDraft = useCallback((payload: AssemblyDraft) => {
    setMode('create');
    setSelectedId(null);
    setSerial(payload.serial);
    setDescription(payload.description);
    setDate(payload.date || todayIso());
    setParentItemId(payload.parentItemId);
    setAssemblyQuantity(payload.assemblyQuantity || 1);
    setSourceWarehouseId(payload.sourceWarehouseId);
    setTargetWarehouseId(payload.targetWarehouseId);
    setCostCenterId(payload.costCenterId);
    setPricingMethod(payload.pricingMethod || 'AVERAGE_COST');
    setLines(payload.lines?.length ? payload.lines : [emptyAssemblyComponentLine()]);
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setGlSkipped(false);
    setError('');
    pinDocumentTabQuery(null);
  }, []);

  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'stock-assembly',
    mode: selectedId ? 'edit' : 'new',
    documentId: selectedId,
    value: draftSnapshot,
    enabled: !selectedId && !isPosted && !isCancelled,
    applyRestore: applyAssemblyDraft,
    isEmpty: (draft) => isAssemblyDraftEmpty(draft, txDefaultWarehouseId),
    restoreMessage: 'تم استعادة مسودة أمر التجميع',
  });

  const stayOnAssembly = (id?: string | null, serialNumber?: string | null) => {
    if (!id) return;
    setSelectedId(id);
    if (serialNumber) setSerial(serialNumber);
    pinDocumentTabQuery(id);
    invalidateStockViews(invalidateQuery);
  };

  const openAssembly = (id: string) => {
    setSelectedId(id);
    pinDocumentTabQuery(id);
  };

  const applyPostResponse = (res: ApiResponse<unknown>) => {
    const { journalEntryId: je, glSkipped: skipped } = extractStockPostResult(res);
    setJournalEntryId(je);
    setGlSkipped(skipped);
  };

  const printAssembly = () => {
    const parent = items.find((i) => i.id === parentItemId);
    printManufacturingVoucher({
      title: 'أمر التجميع',
      number: serial,
      date,
      description,
      parentItemLabel: parent?.arabicName,
      quantity: assemblyQuantity,
      rows: entered.map((line) => ({
        code: line.itemCode,
        name: line.itemName,
        quantity: line.quantity,
        unitCost: line.unitCost,
        total: assemblyLineTotal(line),
      })),
      totalAmount: totalComponentsCost,
      totalsLabel: 'إجمالي تكلفة المكونات',
    });
  };

  const offerAssemblySalesInvoice = useCallback(
    (savedNumber?: string | null) => {
      if (assemblyTxSettings?.warnSalesInvoiceOnAssemblySave !== true || !parentItemId) return;
      const warehouseId = (targetWarehouseId || sourceWarehouseId).trim();
      if (!warehouseId) return;
      const parent = items.find((i) => i.id === parentItemId);
      const num = String(savedNumber ?? serial).trim();
      storeAssemblySalesInvoiceDraft({
        warehouseId,
        assemblySerial: num || null,
        description: num ? `من تجميع ${num}` : 'من عملية تجميع أصناف',
        lines: [
          {
            itemId: parentItemId,
            itemName: parent?.arabicName ?? '',
            quantity: assemblyQuantity,
          },
        ],
      });
      toast('الصنف المجمع جاهز للبيع', {
        description: 'افتح فاتورة مبيعات بالمخزن والصنف والكمية — اختر العميل ليُملأ السعر من قائمة الأسعار.',
        duration: 12000,
        action: {
          label: 'فاتورة مبيعات',
          onClick: () => router.push(destinationAppTabHref(assemblySalesInvoiceDraftHref())),
        },
      });
    },
    [
      assemblyQuantity,
      assemblyTxSettings?.warnSalesInvoiceOnAssemblySave,
      items,
      parentItemId,
      router,
      serial,
      sourceWarehouseId,
      targetWarehouseId,
    ]
  );

  const finishAssemblySave = (posted: boolean, id?: string | null, number?: string | null) => {
    maybeAutoPrintAfterSave(autoPrintOnSave, printAssembly);
    finishDocumentSave({
      label: 'تجميع',
      number,
      posted,
      savedId: id,
      clearDraft,
      onOpen: openAssembly,
      onSavedOpen: (saved) => invalidateQuery(['assembly', saved]),
      reset: resetNew,
    });
    offerAssemblySalesInvoice(number ?? serial);
  };

  const postAssemblyAfterSave = (id: string, number?: string | null) => {
    void apiClient
      .post(`/inventory/assemblies/${id}/post`)
      .then((res) => {
        applyPostResponse(res);
        setSuccess(postSuccessMessage(res));
        invalidateQuery(['assembly', id]);
        invalidateStockViews(invalidateQuery);
        finishAssemblySave(true, id, number);
      })
      .catch((err: unknown) => {
        stayOnAssembly(id, number);
        setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر ترحيل التجميع');
        invalidateStockViews(invalidateQuery);
      });
  };

  const createMutation = useApiMutation<AssemblyRecord, Record<string, unknown>>(
    '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        const id = res.data?.id;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        if (id) invalidateQuery(['assembly', id]);
        if (shouldPost && id) {
          postAssemblyAfterSave(id, res.data?.serial);
          return;
        }
        finishAssemblySave(false, id, res.data?.serial);
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر حفظ أمر التجميع');
      },
    }
  );

  const updateMutation = useApiMutation<AssemblyRecord, Record<string, unknown>>(
    selectedId ? `/inventory/assemblies/${selectedId}` : '/inventory/assemblies',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const id = res.data?.id || selectedId;
        const number = res.data?.serial || serial;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        invalidateStockViews(invalidateQuery);
        if (consumeShouldRepost() && id) {
          void apiClient
            .post(`/inventory/assemblies/${id}/post`, {}, { skipSuccessNotify: true })
            .then((postRes) => {
              setIsPosted(true);
              applyPostResponse(postRes);
              setSuccess(postSuccessMessage(postRes));
              finishAssemblySave(true, id, number);
              invalidateQuery(['assembly', id]);
              invalidateStockViews(invalidateQuery);
            })
            .catch((err: ApiError) => {
              stayOnAssembly(id, res.data?.serial);
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل التجميع');
            });
          return;
        }
        if (shouldPost && id) {
          postAssemblyAfterSave(id, number);
          return;
        }
        finishAssemblySave(false, id, number);
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر تحديث أمر التجميع');
      },
    }
  );

  const unpostMutation = useDocumentPostMutation('/inventory/assemblies', selectedId, 'unpost');

  const handleRestoreCancelled = async () => {
    if (!selectedId || restorePending) return;
    setRestorePending(true);
    try {
      await restoreCancelledDocument({
        restorePath: `/inventory/assemblies/${selectedId}/restore`,
        postPath: `/inventory/assemblies/${selectedId}/post`,
        kind: 'named',
        autoPostOnSave,
      });
      setIsCancelled(false);
      const posted = autoPostOnSave === true;
      setIsPosted(posted);
      if (posted) lockToView();
      else setMode('edit');
      invalidateQuery(['assembly', selectedId]);
      invalidateStockViews(invalidateQuery);
      setSuccess(posted ? 'تمت الاستعادة والترحيل' : 'تمت الاستعادة — المستند غير مرحّل');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاستعادة');
    } finally {
      setRestorePending(false);
    }
  };

  const cancelMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/assemblies/${selectedId}/cancel` : '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsCancelled(true);
        setSuccess('تم إلغاء أمر التجميع');
        invalidateQuery(['assemblies']);
        if (selectedId) invalidateQuery(['assembly', selectedId]);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء التجميع'),
    }
  );

  const buildPayload = () => {
    if (!parentItemId) throw new Error('يرجى اختيار الصنف التجميعي');
    if (!sourceWarehouseId) throw new Error('يرجى اختيار مخزن صرف المكونات');
    if (entered.length === 0) throw new Error('أضف مكوناً واحداً على الأقل أو اضغط تحميل');
    return {
      serial: serial || undefined,
      description: description || undefined,
      date: new Date(`${date}T12:00:00`).toISOString(),
      hijriDate: toHijriDate(date),
      warehouseId: sourceWarehouseId,
      toWarehouseId: targetWarehouseId || sourceWarehouseId,
      costCenterId: costCenterId.trim() ? costCenterId.trim() : undefined,
      lines: [
        {
          assembledItemId: parentItemId,
          assembledQuantity: assemblyQuantity,
          assembledTotal: totalComponentsCost,
          components: entered.map((line) => ({
            componentItemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitCost,
            total: assemblyLineTotal(line),
          })),
        },
      ],
    };
  };

  const handleSave = () => {
    if (readOnly && !postAfterSaveRef.current) return;
    setError('');
    try {
      const body = buildPayload();
      if (selectedId) updateMutation.mutate(body);
      else createMutation.mutate(body);
    } catch (err) {
      postAfterSaveRef.current = false;
      setError(err instanceof Error ? err.message : 'تحقق من البيانات');
    }
  };

  const handleSaveDraft = () => {
    if (isPosted || isCancelled) return;
    postAfterSaveRef.current = autoPostOnSave;
    handleSave();
  };

  const handleSaveAndPost = () => {
    if (isPosted || isCancelled) return;
    postAfterSaveRef.current = true;
    handleSave();
  };

  const handleExplodeBOM = async () => {
    if (!parentItemId) {
      setError('اختر الصنف التجميعي أولاً');
      return;
    }
    if (entered.length > 0) {
      const ok = await confirmAction(
        'سيتم تحميل مكونات الصنف من بطاقة الصنف حسب الكمية المحددة، متابعة؟'
      );
      if (!ok) return;
    }
    setExplodePending(true);
    setError('');
    try {
      const res = await apiClient.get<BomExplosionResponse>(
        `/inventory/items/${parentItemId}/bom-explosion`,
        {
          quantity: assemblyQuantity,
          warehouseId: sourceWarehouseId || undefined,
          pricingMethod,
        }
      );
      const components = res.data?.components ?? [];
      if (!components.length) {
        setError('لا توجد مكونات في بطاقة هذا الصنف');
        return;
      }
      setLines(
        components.map((comp) => ({
          itemId: comp.itemId,
          itemCode: comp.itemCode || '',
          itemName: comp.itemNameAr || '',
          unitId: comp.unit?.id || '',
          unitName: comp.unit?.name || '',
          availableQuantity: Number(comp.availableQuantity) || 0,
          quantity: Number(comp.requiredQuantity) || 0,
          unitCost: Number(comp.unitCost) || 0,
          notes: '',
        }))
      );
      setSuccess('تم تحميل مكونات الصنف من البطاقة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مكونات الصنف');
    } finally {
      setExplodePending(false);
    }
  };

  const resetNew = useCallback(() => {
    clearDraft();
    resetKeepPosted();
    setMode('create');
    setSelectedId(null);
    setSerial('');
    void invalidateNextSerial();
    setDescription('');
    setDate(todayIso());
    setParentItemId('');
    setAssemblyQuantity(1);
    setSourceWarehouseId('');
    setTargetWarehouseId('');
    setCostCenterId('');
    setPricingMethod('AVERAGE_COST');
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setGlSkipped(false);
    setLines([emptyAssemblyComponentLine()]);
    setError('');
    setSuccess('');
    pinDocumentTabQuery(null);
  }, [clearDraft, invalidateNextSerial, resetKeepPosted]);

  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <PageDraftRestoreGate<AssemblyDraft>
          restoreOffer={restoreOffer}
          hide={Boolean(selectedId)}
          message="يوجد مسودة أمر تجميع غير محفوظة."
          acceptRestore={acceptRestore}
          dismissRestore={dismissRestore}
          onRestored={(payload) => {
            applyAssemblyDraft(payload);
            setSuccess('تم استعادة مسودة أمر التجميع');
          }}
        />

        <ItemAssemblyHeader
          docNumber={serial}
          serialReadOnly={serialAutomatic || readOnly}
          serialPlaceholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل رقم المسلسل'}
          onSerialChange={setSerial}
          isPosted={isPosted}
          isCancelled={isCancelled}
          documentId={selectedId}
          parentItemId={parentItemId}
          onParentItemId={setParentItemId}
          parentItems={items}
          assemblyQuantity={assemblyQuantity}
          onAssemblyQuantity={setAssemblyQuantity}
          description={description}
          onDescription={setDescription}
          date={date}
          onDate={setDate}
          sourceWarehouseId={sourceWarehouseId}
          onSourceWarehouseId={(id) => {
            setSourceWarehouseId(id);
            if (!targetWarehouseId) setTargetWarehouseId(id);
          }}
          targetWarehouseId={targetWarehouseId}
          onTargetWarehouseId={setTargetWarehouseId}
          costCenterId={costCenterId}
          onCostCenterId={setCostCenterId}
          pricingMethod={pricingMethod}
          onPricingMethod={(method) => {
            setPricingMethod(method);
            if (method === 'MANUAL') {
              setLines((prev) =>
                prev.map((line) => (line.itemId ? { ...line, unitCost: 0 } : line))
              );
            }
          }}
          disabled={readOnly}
          explodePending={explodePending}
          canExplode={Boolean(parentItemId) && assemblyQuantity > 0 && !isPosted && !isCancelled}
          onExplode={() => void handleExplodeBOM()}
          onSaveDraft={handleSaveDraft}
          onCancel={resetNew}
          saveLabel={assemblySaveLabel}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onBrowseList={() => setBrowseOpen(true)}
          onRestore={() => void handleRestoreCancelled()}
          restorePending={restorePending}
          menuActions={{
            transactionSettingsDocumentType: 'STOCK_ASSEMBLY',
            onTransactionSettingsSaved: () => {
              invalidateAfterTransactionSettingsSave(invalidateQuery, 'STOCK_ASSEMBLY');
              void invalidateNextSerial();
            },
            onNew: resetNew,
            onEdit: () => {
              if (isPosted || isCancelled) {
                setError('يجب فك الترحيل أولاً للتعديل');
                return;
              }
              unlockForEdit();
              setSuccess('');
            },
            onPost: () => handleSaveAndPost(),
            postLabel: 'ترحيل أمر التجميع',
            postPending: savePending,
            onUnpost: () => {
              if (!selectedId) return;
              unpostMutation.mutate(
                {},
                {
                  onSuccess: () => {
                    setIsPosted(false);
                    setIsCancelled(false);
                    setGlSkipped(false);
                    setMode('edit');
                    markUnpostedForEdit();
                    setSuccess('تم فك ترحيل التجميع');
                    stayOnAssembly(selectedId);
                    invalidateQuery(['assembly', selectedId]);
                    invalidateQuery(['journal-entries']);
                    invalidateQuery(['journal-entry']);
                  },
                  onError: (err: ApiError) => setError(err.message || 'فشل فك الترحيل'),
                }
              );
            },
            unpostPending: unpostMutation.isPending,
            onPrint: printAssembly,
            printLabel: 'طباعة أمر التجميع',
            onVoid: () => {
              if (selectedId) cancelMutation.mutate({});
            },
            voidLabel: 'إلغاء التجميع',
            voidPending: cancelMutation.isPending,
          }}
        />

        <AssemblyLinesTable
          lines={lines}
          onChange={setLines}
          warehouseId={sourceWarehouseId}
          asOfDate={date}
          pricingMethod={pricingMethod}
          disabled={readOnly}
          headerDescription={description}
        />

        <AssemblyStickyFooter
          componentCount={entered.length}
          totalComponentsCost={totalComponentsCost}
          assemblyQuantity={assemblyQuantity}
          journalEntryId={journalEntryId}
          isPosted={isPosted}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onSave={handleSaveAndPost}
          onCancel={resetNew}
        />

        <StockMovementBottomSplit
          totalAmount={totalComponentsCost}
          lineCount={entered.length}
          journalEntryId={journalEntryId}
          documentId={selectedId}
          isPosted={isPosted}
          glSkipped={glSkipped}
        />

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر التجميع السابقة">
          <GenericRecordsList
            apiPath="/inventory/assemblies"
            listKey="assemblies-browse"
            paging="skip"
            selectedId={selectedId}
            columns={[
              { id: 'num', header: 'المسلسل', getValue: (r) => String(r.serial ?? r.id.slice(0, 8)) },
              {
                id: 'date',
                header: 'التاريخ',
                getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
              },
              {
                id: 'net',
                header: 'الإجمالي',
                getValue: (r) => Number(r.totalAmount ?? 0).toLocaleString('ar-EG'),
              },
            ]}
            onSelect={(id) => {
              setSelectedId(id);
              setBrowseOpen(false);
              pinDocumentTabQuery(id);
            }}
          />
        </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}

export default function AssemblyPage() {
  return (
    <DocumentModeProvider>
      <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح شاشة التجميع…</p>}>
        <AssemblyPageInner />
      </Suspense>
    </DocumentModeProvider>
  );
}
