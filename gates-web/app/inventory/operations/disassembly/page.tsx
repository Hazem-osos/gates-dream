'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { pinDocumentTabQuery } from '@/lib/navigation/tab-memory';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { ItemDisassemblyHeader } from '@/components/inventory/disassembly/ItemDisassemblyHeader';
import { DisassemblyLinesTable } from '@/components/inventory/disassembly/DisassemblyLinesTable';
import { DisassemblyStickyFooter } from '@/components/inventory/disassembly/DisassemblyStickyFooter';
import {
  disassemblyLineTotal,
  emptyDisassemblyComponentLine,
  isEnteredDisassemblyLine,
  type DisassemblyComponentLine,
} from '@/components/inventory/disassembly/disassembly-line-types';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError, ApiResponse } from '@/lib/api/types';
import { useRepostAfterUnpost } from '@/lib/accounting/ensure-posted-after-save';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  extractStockPostResult,
  postSuccessMessage,
  useDocumentPostMutation,
} from '@/lib/inventory/use-document-post-mutation';
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
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { isUnsetOrDefaultWarehouse } from '@/lib/drafts/form-lines-draft';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';

type ParentItem = {
  id: string;
  serial?: string | null;
  arabicName: string;
  isAssembly?: boolean;
  averageCost?: number | string | null;
};

type DisassemblyExplosionResponse = {
  parentItemUnitCost?: number;
  parentItemDisassemblyTotalCost?: number;
  components: Array<{
    itemId: string;
    itemCode: string;
    itemNameAr: string;
    unit: { id: string; name: string } | null;
    availableQuantity: number;
    resultingQuantity?: number;
    requiredQuantity?: number;
    unitCost: number;
  }>;
};

type DisassemblyRecord = {
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
  lines?: Array<{
    disassembledItemId: string;
    disassembledQuantity?: number | string;
    disassembledUnitPrice?: number | string;
    disassembledTotal?: number | string;
    disassembledItem?: { serial?: string | null; arabicName?: string };
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

type DisassemblyDraft = {
  serial: string;
  description: string;
  date: string;
  parentItemId: string;
  disassemblyQuantity: number;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  costCenterId: string;
  parentUnitCost: number;
  lines: DisassemblyComponentLine[];
};

function isDisassemblyDraftEmpty(
  draft: DisassemblyDraft,
  defaultWarehouseId?: string | null,
): boolean {
  return (
    !draft.serial.trim() &&
    !draft.description.trim() &&
    !draft.parentItemId &&
    isUnsetOrDefaultWarehouse(draft.sourceWarehouseId, defaultWarehouseId) &&
    isUnsetOrDefaultWarehouse(draft.targetWarehouseId, defaultWarehouseId) &&
    !draft.costCenterId.trim() &&
    !(draft.parentUnitCost > 0) &&
    !draft.lines.some(isEnteredDisassemblyLine)
  );
}

function DisassemblyPageInner() {
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const {
    autoPostOnSave,
    autoPrintOnSave,
    saveLabel: legacySaveLabel,
    defaultWarehouseId: txDefaultWarehouseId,
  } = useTransactionDocumentSettings('STOCK_DISASSEMBLY');
  const disassemblySaveLabel = autoPostOnSave ? 'حفظ وترحيل التفكيك' : legacySaveLabel;
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
  const [disassemblyQuantity, setDisassemblyQuantity] = useState(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [glSkipped, setGlSkipped] = useState(false);
  const [parentUnitCost, setParentUnitCost] = useState(0);
  const [lines, setLines] = useState<DisassemblyComponentLine[]>([emptyDisassemblyComponentLine()]);

  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'disassembly',
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

  const { data: itemsResponse } = useApiQuery<ParentItem[]>(
    ['items', 'disassembly-parents'],
    '/inventory/items',
    { limit: 200, isActive: true, isAssembly: true }
  );
  const items = Array.isArray(itemsResponse?.data) ? itemsResponse.data : [];

  const { data: loadedResponse } = useApiQuery<DisassemblyRecord>(
    ['disassembly', selectedId ?? ''],
    selectedId ? `/inventory/disassemblies/${selectedId}` : '/inventory/disassemblies',
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
    setParentItemId(first?.disassembledItemId || '');
    setDisassemblyQuantity(Number(first?.disassembledQuantity) || 1);
    setSourceWarehouseId(loaded.warehouseId || '');
    setTargetWarehouseId(loaded.toWarehouseId || loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setIsPosted(resolvePostedFlag(loaded));
    setIsCancelled(Boolean(loaded.isCancelled));
    const je = loaded.journalEntryId || null;
    setJournalEntryId(je);
    setGlSkipped(resolvePostedFlag(loaded) && !je);
    setParentUnitCost(Number(first?.disassembledUnitPrice) || 0);
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

  const entered = useMemo(() => lines.filter(isEnteredDisassemblyLine), [lines]);
  const recoveredValue = useMemo(
    () => entered.reduce((sum, line) => sum + disassemblyLineTotal(line), 0),
    [entered]
  );
  const parentTotal = parentUnitCost * (disassemblyQuantity || 1);
  const readOnly = isPosted || isCancelled || isReadOnly;

  const draftSnapshot = useMemo<DisassemblyDraft>(
    () => ({
      serial,
      description,
      date,
      parentItemId,
      disassemblyQuantity,
      sourceWarehouseId,
      targetWarehouseId,
      costCenterId,
      parentUnitCost,
      lines,
    }),
    [
      serial,
      description,
      date,
      parentItemId,
      disassemblyQuantity,
      sourceWarehouseId,
      targetWarehouseId,
      costCenterId,
      parentUnitCost,
      lines,
    ]
  );

  const applyDisassemblyDraft = useCallback((payload: DisassemblyDraft) => {
    setMode('create');
    setSelectedId(null);
    setSerial(payload.serial);
    setDescription(payload.description);
    setDate(payload.date || todayIso());
    setParentItemId(payload.parentItemId);
    setDisassemblyQuantity(payload.disassemblyQuantity || 1);
    setSourceWarehouseId(payload.sourceWarehouseId);
    setTargetWarehouseId(payload.targetWarehouseId);
    setCostCenterId(payload.costCenterId);
    setParentUnitCost(payload.parentUnitCost);
    setLines(
      payload.lines?.length ? payload.lines : [emptyDisassemblyComponentLine()]
    );
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
    documentType: 'stock-disassembly',
    mode: selectedId ? 'edit' : 'new',
    documentId: selectedId,
    value: draftSnapshot,
    enabled: !selectedId && !isPosted && !isCancelled,
    applyRestore: applyDisassemblyDraft,
    isEmpty: (draft) => isDisassemblyDraftEmpty(draft, txDefaultWarehouseId),
    restoreMessage: 'تم استعادة مسودة أمر التفكيك',
  });

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
    setDisassemblyQuantity(1);
    setSourceWarehouseId('');
    setTargetWarehouseId('');
    setCostCenterId('');
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setGlSkipped(false);
    setParentUnitCost(0);
    setLines([emptyDisassemblyComponentLine()]);
    setError('');
    setSuccess('');
    pinDocumentTabQuery(null);
  }, [clearDraft, invalidateNextSerial, resetKeepPosted]);

  const stayOnDisassembly = (id?: string | null, serialNumber?: string | null) => {
    if (!id) return;
    setSelectedId(id);
    if (serialNumber) setSerial(serialNumber);
    pinDocumentTabQuery(id);
    invalidateStockViews(invalidateQuery);
  };

  const openDisassembly = (id: string) => {
    setSelectedId(id);
    pinDocumentTabQuery(id);
  };

  const applyPostResponse = (res: ApiResponse<unknown>) => {
    const { journalEntryId: je, glSkipped: skipped } = extractStockPostResult(res);
    setJournalEntryId(je);
    setGlSkipped(skipped);
  };

  const printDisassembly = () => {
    const parent = items.find((i) => i.id === parentItemId);
    printManufacturingVoucher({
      title: 'أمر التفكيك',
      number: serial,
      date,
      description,
      parentItemLabel: parent?.arabicName,
      quantity: disassemblyQuantity,
      rows: entered.map((line) => ({
        code: line.itemCode,
        name: line.itemName,
        quantity: line.quantity,
        unitCost: line.unitCost,
        total: disassemblyLineTotal(line),
      })),
      totalAmount: parentTotal,
      totalsLabel: 'قيمة الصنف المفكك',
    });
  };

  const finishDisassemblySave = (posted: boolean, id?: string | null, number?: string | null) => {
    maybeAutoPrintAfterSave(autoPrintOnSave, printDisassembly);
    finishDocumentSave({
      label: 'تفكيك',
      number,
      posted,
      savedId: id,
      clearDraft,
      onOpen: openDisassembly,
      onSavedOpen: (saved) => invalidateQuery(['disassembly', saved]),
      reset: resetNew,
    });
  };

  const postDisassemblyAfterSave = (id: string, number?: string | null) => {
    void apiClient
      .post(`/inventory/disassemblies/${id}/post`)
      .then((res) => {
        applyPostResponse(res);
        setSuccess(postSuccessMessage(res));
        invalidateQuery(['disassembly', id]);
        invalidateStockViews(invalidateQuery);
        finishDisassemblySave(true, id, number);
      })
      .catch((err: unknown) => {
        stayOnDisassembly(id, number);
        setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر ترحيل التفكيك');
        invalidateStockViews(invalidateQuery);
      });
  };

  const createMutation = useApiMutation<DisassemblyRecord, Record<string, unknown>>(
    '/inventory/disassemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        const id = res.data?.id;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        if (id) invalidateQuery(['disassembly', id]);
        if (shouldPost && id) {
          postDisassemblyAfterSave(id, res.data?.serial);
          return;
        }
        finishDisassemblySave(false, id, res.data?.serial);
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر حفظ أمر التفكيك');
      },
    }
  );

  const updateMutation = useApiMutation<DisassemblyRecord, Record<string, unknown>>(
    selectedId ? `/inventory/disassemblies/${selectedId}` : '/inventory/disassemblies',
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
            .post(`/inventory/disassemblies/${id}/post`, {}, { skipSuccessNotify: true })
            .then((postRes) => {
              setIsPosted(true);
              applyPostResponse(postRes);
              setSuccess(postSuccessMessage(postRes));
              finishDisassemblySave(true, id, number);
              invalidateQuery(['disassembly', id]);
              invalidateStockViews(invalidateQuery);
            })
            .catch((err: ApiError) => {
              stayOnDisassembly(id, res.data?.serial);
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل التفكيك');
            });
          return;
        }
        if (shouldPost && id) {
          postDisassemblyAfterSave(id, number);
          return;
        }
        finishDisassemblySave(false, id, number);
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر تحديث أمر التفكيك');
      },
    }
  );

  const unpostMutation = useDocumentPostMutation('/inventory/disassemblies', selectedId, 'unpost');

  const handleRestoreCancelled = async () => {
    if (!selectedId || restorePending) return;
    setRestorePending(true);
    try {
      await restoreCancelledDocument({
        restorePath: `/inventory/disassemblies/${selectedId}/restore`,
        postPath: `/inventory/disassemblies/${selectedId}/post`,
        kind: 'named',
        autoPostOnSave,
      });
      setIsCancelled(false);
      const posted = autoPostOnSave === true;
      setIsPosted(posted);
      if (posted) lockToView();
      else setMode('edit');
      invalidateQuery(['disassembly', selectedId]);
      invalidateStockViews(invalidateQuery);
      setSuccess(posted ? 'تمت الاستعادة والترحيل' : 'تمت الاستعادة — المستند غير مرحّل');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاستعادة');
    } finally {
      setRestorePending(false);
    }
  };

  const cancelMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/disassemblies/${selectedId}/cancel` : '/inventory/disassemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsCancelled(true);
        setSuccess('تم إلغاء أمر التفكيك');
        invalidateQuery(['disassemblies']);
        if (selectedId) invalidateQuery(['disassembly', selectedId]);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء التفكيك'),
    }
  );

  const buildPayload = () => {
    if (!parentItemId) throw new Error('يرجى اختيار الصنف المراد تفكيكه');
    if (!sourceWarehouseId) throw new Error('يرجى اختيار مخزن صرف الصنف المفكك');
    if (entered.length === 0) throw new Error('أضف مكوناً ناتجاً واحداً على الأقل أو اضغط تحميل');
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
          disassembledItemId: parentItemId,
          disassembledQuantity: disassemblyQuantity,
          disassembledUnitPrice: parentUnitCost,
          disassembledTotal: parentTotal || recoveredValue,
          components: entered.map((line) => ({
            componentItemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitCost,
            total: disassemblyLineTotal(line),
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
      setError('اختر الصنف المراد تفكيكه أولاً');
      return;
    }
    if (entered.length > 0) {
      const ok = await confirmAction(
        'سيتم تحميل مكونات الصنف من بطاقة الصنف وتوزيع تكلفة التفكيك عليها حسب الكمية، متابعة؟'
      );
      if (!ok) return;
    }
    setExplodePending(true);
    setError('');
    try {
      const res = await apiClient.get<DisassemblyExplosionResponse>(
        `/inventory/items/${parentItemId}/disassembly-explosion`,
        {
          quantity: disassemblyQuantity,
          warehouseId: targetWarehouseId || undefined,
          sourceWarehouseId: sourceWarehouseId || undefined,
        }
      );
      const components = res.data?.components ?? [];
      if (!components.length) {
        setError('لا توجد مكونات في بطاقة هذا الصنف');
        return;
      }
      if (res.data?.parentItemUnitCost != null) {
        setParentUnitCost(Number(res.data.parentItemUnitCost) || 0);
      }
      setLines(
        components.map((comp) => ({
          itemId: comp.itemId,
          itemCode: comp.itemCode || '',
          itemName: comp.itemNameAr || '',
          unitId: comp.unit?.id || '',
          unitName: comp.unit?.name || '',
          availableQuantity: Number(comp.availableQuantity) || 0,
          quantity: Number(comp.resultingQuantity ?? comp.requiredQuantity) || 0,
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

  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <PageDraftRestoreGate<DisassemblyDraft>
          restoreOffer={restoreOffer}
          hide={Boolean(selectedId)}
          message="يوجد مسودة أمر تفكيك غير محفوظة."
          acceptRestore={acceptRestore}
          dismissRestore={dismissRestore}
          onRestored={(payload) => {
            applyDisassemblyDraft(payload);
            setSuccess('تم استعادة مسودة أمر التفكيك');
          }}
        />

        <ItemDisassemblyHeader
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
          disassemblyQuantity={disassemblyQuantity}
          onDisassemblyQuantity={setDisassemblyQuantity}
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
          disabled={readOnly}
          explodePending={explodePending}
          canExplode={Boolean(parentItemId) && disassemblyQuantity > 0 && !isPosted && !isCancelled}
          onExplode={() => void handleExplodeBOM()}
          onSaveDraft={handleSaveDraft}
          onCancel={resetNew}
          saveLabel={disassemblySaveLabel}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onBrowseList={() => setBrowseOpen(true)}
          onRestore={() => void handleRestoreCancelled()}
          restorePending={restorePending}
          menuActions={{
            transactionSettingsDocumentType: 'STOCK_DISASSEMBLY',
            onTransactionSettingsSaved: () => {
              invalidateAfterTransactionSettingsSave(invalidateQuery, 'STOCK_DISASSEMBLY');
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
            postLabel: 'ترحيل أمر التفكيك',
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
                    setSuccess('تم فك ترحيل التفكيك');
                    stayOnDisassembly(selectedId);
                    invalidateQuery(['disassembly', selectedId]);
                    invalidateQuery(['journal-entries']);
                    invalidateQuery(['journal-entry']);
                  },
                  onError: (err: ApiError) => setError(err.message || 'فشل فك الترحيل'),
                }
              );
            },
            unpostPending: unpostMutation.isPending,
            onPrint: printDisassembly,
            printLabel: 'طباعة أمر التفكيك',
            onVoid: () => {
              if (selectedId) cancelMutation.mutate({});
            },
            voidLabel: 'إلغاء التفكيك',
            voidPending: cancelMutation.isPending,
          }}
        />

        <DisassemblyLinesTable
          headerDescription={description}
          lines={lines}
          onChange={setLines}
          warehouseId={targetWarehouseId}
          asOfDate={date}
          disabled={readOnly}
        />

        <DisassemblyStickyFooter
          componentCount={entered.length}
          recoveredComponentsValue={recoveredValue}
          parentItemDisassemblyTotalCost={parentTotal}
          journalEntryId={journalEntryId}
          isPosted={isPosted}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onSave={handleSaveAndPost}
          onCancel={resetNew}
        />

        <StockMovementBottomSplit
          totalAmount={parentTotal}
          lineCount={entered.length}
          journalEntryId={journalEntryId}
          documentId={selectedId}
          isPosted={isPosted}
          glSkipped={glSkipped}
        />

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر التفكيك السابقة">
          <GenericRecordsList
            apiPath="/inventory/disassemblies"
            listKey="disassemblies-browse"
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

export default function DisassemblyPage() {
  return (
    <DocumentModeProvider>
      <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح شاشة التفكيك…</p>}>
        <DisassemblyPageInner />
      </Suspense>
    </DocumentModeProvider>
  );
}
