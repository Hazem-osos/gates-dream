'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { confirmAction } from '@/lib/feedback/confirm';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { Plus, Trash2 } from 'lucide-react';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  Button,
  IconButton,
  compactControlClass,
  compactLabelClass,
} from '@/components/ui';
import { StockDocumentsListSection } from '@/components/inventory/StockDocumentsListSection';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { ItemSelect } from '@/components/form/ItemSelect';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import {
  inventoryTransferHeaderFormSchema,
  inventoryStdLineSchema,
  type InventoryTransferHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError, ApiResponse } from '@/lib/api/types';
import { useRepostAfterUnpost } from '@/lib/accounting/ensure-posted-after-save';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  postSuccessMessage,
  useDocumentPostMutation,
} from '@/lib/inventory/use-document-post-mutation';
import {
  useStoreDocumentSerial,
  STORE_DOCUMENT_UNPOSTED_LABEL,
} from '@/lib/inventory/use-store-document-serial';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import { apiClient } from '@/lib/api/client';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { rememberTabHref, rememberTabSearch } from '@/lib/navigation/tab-memory';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { consumeMfgTransferPrefill } from '@/lib/manufacturing/mfg-transfer-prefill';
import Link from 'next/link';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import { stockHeaderFieldsFromSource } from '@/lib/inventory/apply-source-to-stock-document';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { STOCK_TRANSFER_SOURCE_TYPES } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';


interface TransferLine {
  itemId: string;
  itemName?: string;
  quantity: number;
  unitPrice: number;
}

function resolveItemCost(item: object | undefined): number {
  if (!item) return 0;
  const catalog = item as { averageCost?: unknown; lastPurchasePrice?: unknown };
  const average = Number(catalog.averageCost);
  if (Number.isFinite(average) && average > 0) return average;
  const lastPurchase = Number(catalog.lastPurchasePrice);
  if (Number.isFinite(lastPurchase) && lastPurchase > 0) return lastPurchase;
  return 0;
}

interface TransferDocumentDetail extends Record<string, unknown> {
  id?: string;
  serial?: string;
  serialNumber?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  fromCostCenterId?: string;
  toCostCenterId?: string;
  isPosted?: boolean;
  items?: Record<string, unknown>[];
  lines?: Record<string, unknown>[];
}

type TransferDraft = {
  form: InventoryTransferHeaderFormInput;
  lines: TransferLine[];
};

function emptyTransferFormDefaults(): InventoryTransferHeaderFormInput {
  const t = new Date().toISOString().split('T')[0];
  return {
    serialNumber: '',
    description: '',
    date: t,
    hijriDate: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    fromCostCenterId: '',
    toCostCenterId: '',
    statusPosted: false,
    useBarcode: true,
    hideExistingQty: false,
  };
}

function headerFromTransferDoc(doc: TransferDocumentDetail): InventoryTransferHeaderFormInput {
  return {
    serialNumber: String(doc.serialNumber ?? doc.serial ?? ''),
    description: String(doc.description ?? ''),
    date: doc.date
      ? new Date(String(doc.date)).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    hijriDate: String(doc.hijriDate ?? ''),
    fromWarehouseId: String(doc.fromWarehouseId ?? ''),
    toWarehouseId: String(doc.toWarehouseId ?? ''),
    fromCostCenterId: String(doc.fromCostCenterId ?? ''),
    toCostCenterId: String(doc.toCostCenterId ?? ''),
    statusPosted: resolvePostedFlag(doc),
    useBarcode: true,
    hideExistingQty: false,
  };
}

function linesFromTransferDoc(doc: TransferDocumentDetail): TransferLine[] {
  const raw = Array.isArray(doc.lines)
    ? doc.lines
    : Array.isArray(doc.items)
      ? doc.items
      : [];
  return raw.map((line) => {
    const item =
      line.item && typeof line.item === 'object'
        ? (line.item as Record<string, unknown>)
        : null;
    return {
      itemId: String(line.itemId ?? ''),
      itemName: item
        ? String(item.arabicName ?? item.englishName ?? '')
        : String(line.itemName ?? ''),
      quantity: Number(
        line.transMainQty ?? line.transQty ?? line.quantity ?? line.qty ?? 0,
      ),
      unitPrice: Number(line.unitPrice ?? line.price ?? 0),
    };
  });
}

function isTransferDraftEmpty(draft: TransferDraft): boolean {
  const form = draft.form;
  return (
    !form.serialNumber?.trim() &&
    !form.description?.trim() &&
    !form.fromWarehouseId &&
    !form.toWarehouseId &&
    !(draft.lines ?? []).some((line) => line.itemId || Number(line.quantity) || Number(line.unitPrice))
  );
}

function transferSerialFromResponse(res: ApiResponse<unknown> | undefined): string | undefined {
  const data = res?.data;
  if (data && typeof data === 'object') {
    const serial = (data as { serialNumber?: unknown; serial?: unknown }).serialNumber
      ?? (data as { serial?: unknown }).serial;
    if (typeof serial === 'string' && serial.trim()) return serial;
  }
  return undefined;
}

function transferIdFromResponse(res: ApiResponse<unknown> | undefined): string | null {
  const data = res?.data;
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id;
  }
  return null;
}

function transferPostedFromResponse(res: ApiResponse<unknown> | undefined): boolean {
  const data = res?.data;
  return Boolean(data && typeof data === 'object' && (data as { isPosted?: unknown }).isPosted);
}

function postFailureFromSave(res: ApiResponse<unknown> | undefined): string | null {
  if (transferPostedFromResponse(res)) return null;
  const message = typeof res?.message === 'string' ? res.message.trim() : '';
  if (!message.startsWith('تم الحفظ.')) return null;
  return message.slice('تم الحفظ.'.length).trim() || 'تم الحفظ لكن تعذر الترحيل';
}

function needsStockGlSetupHint(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return /حساب|جرد|مخزون|GL|configured/i.test(m);
}

function pinTransferTabSearch(id: string | null) {
  if (typeof window === 'undefined') return;
  const path = normalizeAppPath(window.location.pathname);
  if (id) {
    const qs = `id=${id}`;
    window.history.replaceState(null, '', `?${qs}`);
    rememberTabSearch(path, qs);
    rememberTabHref(path, `${path}?${qs}`);
    return;
  }
  window.history.replaceState(null, '', path);
  rememberTabSearch(path, '');
  rememberTabHref(path, path);
}

export default function TransferPage() {
  return (
    <DocumentModeProvider>
      <TransferPageInner />
    </DocumentModeProvider>
  );
}

function TransferPageInner() {
  const searchParams = useOwnTabSearchParams();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const { markUnpostedForEdit, resetKeepPosted } = useRepostAfterUnpost();
  const invalidateQuery = useInvalidateQuery();
  const todayStr = new Date().toISOString().split('T')[0];
  const skipServerHydrateRef = useRef(false);
  const postAfterSaveRef = useRef(false);
  const [mfgTransferHint, setMfgTransferHint] = useState<{
    returnHref?: string;
    returnLabel?: string;
    shortageOnly?: boolean;
  } | null>(null);

  const inputCls = compactControlClass;
  const labelCls = compactLabelClass;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<InventoryTransferHeaderFormInput>({
    resolver: zodResolver(inventoryTransferHeaderFormSchema) as Resolver<InventoryTransferHeaderFormInput>,
    defaultValues: {
      serialNumber: '',
      description: '',
      date: todayStr,
      hijriDate: '',
      fromWarehouseId: '',
      toWarehouseId: '',
      fromCostCenterId: '',
      toCostCenterId: '',
      statusPosted: false,
      useBarcode: true,
      hideExistingQty: false,
    },
    mode: 'onTouched',
  });

  const statusPosted = watch('statusPosted');
  const hideExistingQty = watch('hideExistingQty');
  const fromWarehouseId = watch('fromWarehouseId');
  const toWarehouseId = watch('toWarehouseId');
  const watchedForm = watch();

  const [transferLines, setTransferLines] = useState<TransferLine[]>([]);
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const transferLinesRef = useRef<TransferLine[]>([]);
  transferLinesRef.current = transferLines;

  const replaceTransferLines = useCallback(
    (next: TransferLine[] | ((prev: TransferLine[]) => TransferLine[])) => {
      setTransferLines((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        transferLinesRef.current = resolved;
        return resolved;
      });
    },
    []
  );

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );

  const setSerialNumber = useCallback(
    (value: string) =>
      setValue('serialNumber', value, { shouldDirty: false, shouldValidate: false }),
    [setValue]
  );
  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'transfer',
    enabled: !selectedTransferId,
    setSerial: setSerialNumber,
  });

  useEffect(() => {
    if (!selectedTransferId) {
      setMode('create');
      return;
    }
    if (statusPosted) lockToView();
    else setMode('edit');
  }, [lockToView, selectedTransferId, setMode, statusPosted]);

  const openTransfer = useCallback((id: string | null) => {
    setSelectedTransferId(id);
    pinTransferTabSearch(id);
  }, []);
  const [showList, setShowList] = useState(false);

  const draftSnapshot = useMemo<TransferDraft>(
    () => ({ form: watchedForm, lines: transferLines }),
    [watchedForm, transferLines]
  );

  const applyTransferDraft = useCallback(
    (payload: TransferDraft) => {
      skipServerHydrateRef.current = true;
      reset({ ...emptyTransferFormDefaults(), ...payload.form });
      replaceTransferLines(Array.isArray(payload.lines) ? payload.lines : []);
    },
    [replaceTransferLines, reset]
  );

  useEffect(() => {
    if (selectedTransferId) return;
    const prefill = consumeMfgTransferPrefill();
    if (!prefill) return;
    skipServerHydrateRef.current = true;
    reset({
      ...emptyTransferFormDefaults(),
      description: prefill.description,
      fromWarehouseId: prefill.fromWarehouseId,
      toWarehouseId: prefill.toWarehouseId,
    });
    replaceTransferLines(
      prefill.lines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        quantity: l.quantity,
        unitPrice: 0,
      }))
    );
    setMfgTransferHint({
      returnHref: prefill.returnHref,
      returnLabel: prefill.returnLabel,
      shortageOnly: prefill.shortageOnly,
    });
    setSuccess(
      prefill.shortageOnly
        ? 'تم تحميل بنود عجز الخامات — راجع الكميات ثم «حفظ وترحيل»'
        : 'تم تحميل بنود التحويل من التصنيع — راجع الكميات ثم احفظ'
    );
  }, [selectedTransferId, replaceTransferLines, reset]);

  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'stock-transfer',
    mode: selectedTransferId ? 'edit' : 'new',
    documentId: selectedTransferId,
    value: draftSnapshot,
    enabled: !statusPosted,
    applyRestore: applyTransferDraft,
    isEmpty: isTransferDraftEmpty,
    restoreMessage: 'تم استعادة مسودة النقل المخزني',
  });

  // Fetch single transfer for editing
  const { data: transferResponse } = useApiQuery<TransferDocumentDetail>(
    ['transfer', selectedTransferId],
    `/inventory/transfers/${selectedTransferId}`,
    undefined,
    { enabled: !!selectedTransferId }
  );
  const selectedTransfer = selectedTransferId ? transferResponse?.data : undefined;

  // Load transfer data when selected
  useEffect(() => {
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    if (!selectedTransferId || !selectedTransfer) return;
    reset(headerFromTransferDoc(selectedTransfer));
    replaceTransferLines(linesFromTransferDoc(selectedTransfer));
  }, [replaceTransferLines, selectedTransfer, selectedTransferId, reset]);

  const clearTransferForNext = () => {
    clearDraft();
    setMfgTransferHint(null);
    openTransfer(null);
    replaceTransferLines([]);
    reset(emptyTransferFormDefaults());
    setSourceBarKey((k) => k + 1);
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, getValues('description'));
    if (header.warehouseId) setValue('fromWarehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    replaceTransferLines(
      payload.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        quantity: line.quantity || 0,
        unitPrice: line.unitPrice || 0,
      }))
    );
    toast.success(`تم التحميل من ${payload.sourceNumber}`);
  };

  const transferMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/transfers',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        const failure = postFailureFromSave(res);
        const id = transferIdFromResponse(res);
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        if (failure) {
          setError(failure);
          setSuccess('');
          if (id) openTransfer(id);
          return;
        }
        const number = transferSerialFromResponse(res);
        const finish = (posted: boolean) => {
          finishDocumentSave({
            label: 'تحويل',
            number,
            posted,
            savedId: id,
            clearDraft,
            onOpen: (saved) => openTransfer(saved),
            onSavedOpen: (saved) => invalidateQuery(['transfer', saved]),
            reset: clearTransferForNext,
          });
        };
        if (shouldPost && id) {
          void apiClient
            .post(`/inventory/transfers/${id}/post`)
            .then((postRes) => {
              setSuccess(postSuccessMessage(postRes));
              setValue('statusPosted', true);
              invalidateStockViews(invalidateQuery);
              finish(true);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل');
              if (id) openTransfer(id);
              invalidateStockViews(invalidateQuery);
            });
          return;
        }
        finish(transferPostedFromResponse(res));
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const transferUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedTransferId ? `/inventory/transfers/${selectedTransferId}` : '/inventory/transfers',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateStockViews(invalidateQuery);
        const failure = postFailureFromSave(res);
        const id = selectedTransferId ?? transferIdFromResponse(res);
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        if (failure) {
          setError(failure);
          setSuccess('');
          if (id) openTransfer(id);
          return;
        }
        const number =
          transferSerialFromResponse(res) ||
          selectedTransfer?.serialNumber ||
          selectedTransfer?.serial;
        const finish = (posted: boolean) => {
          finishDocumentSave({
            label: 'تحويل',
            number,
            posted,
            savedId: id,
            clearDraft,
            onOpen: (saved) => openTransfer(saved),
            onSavedOpen: (saved) => invalidateQuery(['transfer', saved]),
            reset: clearTransferForNext,
          });
        };
        if (shouldPost && id) {
          void apiClient
            .post(`/inventory/transfers/${id}/post`)
            .then((postRes) => {
              setSuccess(postSuccessMessage(postRes));
              setValue('statusPosted', true);
              invalidateStockViews(invalidateQuery);
              finish(true);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل');
              invalidateStockViews(invalidateQuery);
            });
          return;
        }
        finish(transferPostedFromResponse(res));
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  const transferDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedTransferId ? `/inventory/transfers/${selectedTransferId}` : '/inventory/transfers',
    'DELETE',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setSuccess('تم حذف النقل المخزني بنجاح');
        invalidateStockViews(invalidateQuery);
        clearTransferForNext();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  const postTransferMutation = useDocumentPostMutation(
    '/inventory/transfers',
    selectedTransferId,
    'post'
  );
  const unpostTransferMutation = useDocumentPostMutation(
    '/inventory/transfers',
    selectedTransferId,
    'unpost'
  );

  const loading = transferMutation.isPending || transferUpdateMutation.isPending || transferDeleteMutation.isPending;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (post && !selectedTransferId) {
      postAfterSaveRef.current = true;
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      void handleSubmit(onSaveValid, onFieldErrors(setError))();
      return;
    }
    if (!selectedTransferId) {
      setError('احفظ النقل أولاً');
      return;
    }

    if (post) {
      postTransferMutation.mutate(
        {},
        {
          onSuccess: (res) => {
            setSuccess(postSuccessMessage(res));
            setValue('statusPosted', true);
            invalidateStockViews(invalidateQuery);
            if (selectedTransferId) invalidateQuery(['transfer', selectedTransferId]);
          },
          onError: (error: ApiError) => {
            setError(error.message || 'حدث خطأ أثناء الترحيل');
          },
        }
      );
    } else {
      unpostTransferMutation.mutate(
        {},
        {
          onSuccess: () => {
            setSuccess('تم فك ترحيل النقل المخزني بنجاح');
            setValue('statusPosted', false);
            markUnpostedForEdit();
            invalidateStockViews(invalidateQuery);
          },
          onError: (error: ApiError) => {
            setError(error.message || 'حدث خطأ أثناء فك الترحيل');
          },
        }
      );
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedTransferId) {
      setError('يرجى اختيار نقل أولاً');
      return;
    }

    if (await confirmAction('هل أنت متأكد من حذف هذا النقل؟')) {
      transferDeleteMutation.mutate({});
    }
  };

  // Handle new transfer
  const handleNew = () => {
    resetKeepPosted();
    setError('');
    setSuccess('');
    clearTransferForNext();
  };

  const handleRestoreDraft = () => {
    const payload = acceptRestore();
    if (!payload) return;
    applyTransferDraft(payload);
    setSuccess('تم استعادة مسودة النقل المخزني');
  };

  const addTransferLine = () => {
    replaceTransferLines((prev) => [...prev, { itemId: '', quantity: 0, unitPrice: 0 }]);
  };

  const removeTransferLine = (index: number) => {
    replaceTransferLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTransferLine = (index: number, field: keyof TransferLine, value: string | number) => {
    replaceTransferLines((prev) => {
      const updatedLines = [...prev];
      updatedLines[index] = { ...updatedLines[index], [field]: value };
      return updatedLines;
    });
  };

  const totalAmount = transferLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0
  );

  const onSaveValid: SubmitHandler<InventoryTransferHeaderFormInput> = (values) => {
    setError('');
    setSuccess('');
    const latestLines = transferLinesRef.current.filter(
      (line) => String(line.itemId ?? '').trim() && Number(line.quantity) > 0
    );
    const linesParsed = z.array(inventoryStdLineSchema).min(1, 'يرجى إضافة أصناف للنقل').safeParse(latestLines);
    if (!linesParsed.success) {
      const msg = linesParsed.error.issues[0]?.message;
      setError(msg || 'تحقق من بنود الأصناف');
      return;
    }
    const requestBody = {
      serial: values.serialNumber || undefined,
      serialNumber: values.serialNumber || undefined,
      description: values.description,
      date: new Date(values.date).toISOString(),
      hijriDate: values.hijriDate || undefined,
      fromWarehouseId: values.fromWarehouseId,
      toWarehouseId: values.toWarehouseId,
      fromCostCenterId: values.fromCostCenterId || undefined,
      toCostCenterId: values.toCostCenterId || undefined,
      lines: linesParsed.data.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice) || 0,
      })),
    };
    if (selectedTransferId) {
      transferUpdateMutation.mutate(requestBody);
    } else {
      transferMutation.mutate(requestBody);
    }
  };

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {error && needsStockGlSetupHint(error) ? (
        <p className="mb-3 text-right text-sm text-slate-700">
          راجع{' '}
          <Link href="/inventory/guide" className="font-semibold text-[#0E78AA] underline">
            دليل المخازن (حساب المخزون لكل مخزن)
          </Link>
          {' '}قبل إعادة الترحيل. التحويل يحفظ كمسودة أولاً؛ الترحيل يحرّك الكميات ويُنشئ القيد في الجرد المستمر.
        </p>
      ) : null}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      {mfgTransferHint && !selectedTransferId ? (
        <div className="mb-4 rounded-xl border border-[#D6EAF3] bg-[#F8FBFD] px-4 py-3 text-right text-sm text-[#0A3D5E]">
          <p className="font-semibold">تحويل من التصنيع</p>
          <p className="mt-1 text-slate-600">
            {mfgTransferHint.shortageOnly
              ? 'البنود المعروضة = عجز الكمية فقط (غير المتاح في مخزن المصدر).'
              : 'البنود من نموذج التصنيع — عدّل الكميات إن لزم.'}
            {' '}
            «حفظ وترحيل» ينقل المخزون بين المخزنين؛ لا يُنشأ قيد إلا عند الترحيل وليس عند الحفظ فقط.
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            {mfgTransferHint.returnHref ? (
              <Link href={mfgTransferHint.returnHref} className="font-semibold text-[#0E78AA] underline">
                ← رجوع إلى {mfgTransferHint.returnLabel || 'التصنيع'}
              </Link>
            ) : null}
            <Link href="/inventory/guide" className="text-[#0E78AA] underline">
              إعداد حسابات المخازن
            </Link>
          </p>
        </div>
      ) : null}

      {restoreOffer && !selectedTransferId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة غير محفوظة من قبل ما خرجت من الصفحة."
          onRestore={handleRestoreDraft}
          onDismiss={dismissRestore}
        />
      ) : null}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'تحويل مخزني' },
        ]}
        title="تحويل بين المخازن"
        docNumber={watch('serialNumber') || ''}
        statusTone={statusPosted ? 'success' : 'warning'}
        statusLabel={statusPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL}
        saveLabel={STORE_SAVE_AND_POST_LABEL}
        onSaveDraft={() => {
          postAfterSaveRef.current = true;
          if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          void handleSubmit(onSaveValid, onFieldErrors(setError))();
        }}
        onCancel={handleNew}
        cancelLabel="تراجع"
        onPost={() => handlePostUnpost(true)}
        postTriggerId="inventory-transfer.post-click"
        savePending={loading}
        postPending={postTransferMutation.isPending}
        canPost={!!selectedTransferId && !statusPosted}
        canSave={!isReadOnly && !statusPosted}
        hideStandalonePost
        navEntity="transfer"
        currentId={selectedTransferId}
        onNavigate={openTransfer}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        standardActions={{
          hasDocument: Boolean(selectedTransferId),
          isPosted: statusPosted,
          onEdit: () => {
            if (statusPosted) {
              setError('يجب إلغاء الترحيل أولاً للتعديل');
              return;
            }
            unlockForEdit();
          },
          onPost: () => handlePostUnpost(true),
          onUnpost: () => handlePostUnpost(false),
          onVoid: handleDelete,
          onNew: handleNew,
          newLabel: 'جديد',
        }}
        extraActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={transferLines.some((l) => Boolean(l.itemId))}
            disabled={isReadOnly || statusPosted}
            allowedTypes={STOCK_TRANSFER_SOURCE_TYPES}
            onHydrate={handleSourceHydrate}
          />
        }
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="التحويلات السابقة">
        <StockDocumentsListSection
          title=""
          apiPath="/inventory/transfers"
          listKey="transfers"
          variant="transfer"
          selectedId={selectedTransferId}
          onSelect={(id) => {
            openTransfer(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />
      <DocumentFormLock>
      <FormSectionCard title="بيانات التحويل" subtitle="المسلسل والتاريخ والمخازن">
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
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" {...register('description')} />
          <div data-tour-id="transfer-warehouses">
            <CompactFormField label="من مخزن" error={errors.fromWarehouseId?.message}>
              <Controller
                name="fromWarehouseId"
                control={control}
                render={({ field }) => (
                  <WarehouseSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    className={`${inputCls} ${errors.fromWarehouseId ? 'border-red-400' : ''}`}
                    emptyLabel="اختر المخزن"
                    excludeIds={toWarehouseId ? [toWarehouseId] : undefined}
                  />
                )}
              />
            </CompactFormField>
          </div>
          <CompactFormField label="إلى مخزن" error={errors.toWarehouseId?.message}>
            <Controller
              name="toWarehouseId"
              control={control}
              render={({ field }) => (
                  <WarehouseSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    className={`${inputCls} ${errors.toWarehouseId ? 'border-red-400' : ''}`}
                    emptyLabel="اختر المخزن"
                    excludeIds={fromWarehouseId ? [fromWarehouseId] : undefined}
                  />
              )}
            />
          </CompactFormField>
      </FormSectionCard>
      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="من م التكلفة">
            <Controller
              name="fromCostCenterId"
              control={control}
              render={({ field }) => (
                <CostCenterSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={inputCls}
                  emptyLabel="اختر مركز التكلفة"
                />
              )}
            />
          </CompactFormField>
          <CompactFormField label="إلى م التكلفة">
            <Controller
              name="toCostCenterId"
              control={control}
              render={({ field }) => (
                <CostCenterSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={inputCls}
                  emptyLabel="اختر مركز التكلفة"
                />
              )}
            />
          </CompactFormField>
          <div className="flex flex-col justify-end gap-2">
            <Controller
              name="useBarcode"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#0E78AA]/50"
                  />
                  استخدام الباركود
                </label>
              )}
            />
            <Controller
              name="hideExistingQty"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#0E78AA]/50"
                  />
                  عدم إظهار الكمية المتاحة
                </label>
              )}
            />
          </div>
        </div>
      </AdvancedFieldsSection>

      <div data-tour-id="transfer-lines-card">
      <FormSectionCard title="بنود التحويل" subtitle="الصنف والكمية والتكلفة" bodyClassName="space-y-3">
          {isReadOnly ? null : (
          <div className="flex items-center justify-end">
            <Button type="button" variant="primary" className="gap-2" onClick={addTransferLine}>
              <Plus className="h-4 w-4" aria-hidden />
              إضافة صنف
            </Button>
          </div>
          )}
          {transferLines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">لا توجد أصناف. اضغط «إضافة صنف».</p>
          ) : (
            transferLines.map((line, index) => (
              <div
                key={`transfer-line-${index}`}
                className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                <div>
                  <label className={labelCls}>الصنف</label>
                  <ItemSelect
                    value={line.itemId}
                    onChange={(id) => {
                      if (!id) {
                        replaceTransferLines((prev) => {
                          const next = [...prev];
                          next[index] = { ...next[index], itemId: '', itemName: '', unitPrice: 0 };
                          return next;
                        });
                        return;
                      }
                      updateTransferLine(index, 'itemId', id);
                    }}
                    onItemResolved={(item) => {
                      if (!item) return;
                      replaceTransferLines((prev) => {
                        const next = [...prev];
                        next[index] = {
                          ...next[index],
                          itemId: item.id,
                          itemName: item.arabicName,
                          unitPrice: resolveItemCost(item),
                        };
                        return next;
                      });
                    }}
                    className={inputCls}
                    emptyLabel="اختر الصنف"
                    fallbackLabel={line.itemName}
                  />
                </div>
                {hideExistingQty ? null : (
                <div>
                  <label className={labelCls}>الكمية المتاحة</label>
                  <span className={`${inputCls} flex items-center`}>
                    {fromWarehouseId ? (
                      <InvoiceLineStockBalanceCell
                        itemId={line.itemId}
                        warehouseId={fromWarehouseId}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">اختر مخزن المصدر</span>
                    )}
                  </span>
                </div>
                )}
                <div>
                  <label className={labelCls}>الكمية المنقولة</label>
                  <TableNumberInput
                    className={inputCls}
                    value={line.quantity}
                    onValueCommit={(n) => updateTransferLine(index, 'quantity', n)}
                  />
                </div>
                <div>
                  <label className={labelCls}>التكلفة</label>
                  <TableNumberInput
                    className={inputCls}
                    value={line.unitPrice}
                    onValueCommit={(n) => updateTransferLine(index, 'unitPrice', n)}
                  />
                </div>
                {isReadOnly ? null : (
                <div className="flex items-end justify-end">
                  <IconButton
                    icon={Trash2}
                    label="حذف السطر"
                    variant="danger"
                    onClick={() => removeTransferLine(index)}
                  />
                </div>
                )}
              </div>
            ))
          )}
      </FormSectionCard>
      </div>
      </DocumentFormLock>

      {isReadOnly ? null : (
      <FormStickyFooter
        status={`${transferLines.length} بند · ${totalAmount.toLocaleString('ar-EG')} ج.م`}
      />
      )}

      <StockMovementBottomSplit
        totalAmount={totalAmount}
        lineCount={transferLines.length}
        journalEntryId={(selectedTransfer as { journalEntryId?: string })?.journalEntryId}
        documentId={selectedTransferId}
      />
    </ErpDocumentLayout>
  );
}
