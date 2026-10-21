'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { pinDocumentTabQuery } from '@/lib/navigation/tab-memory';
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
import {
  StockVoucherLinesGrid,
  blankStockVoucherLine,
  seedStockVoucherLines,
  type StockVoucherLine,
} from '@/components/inventory/stock/StockVoucherLinesGrid';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  compactControlClass,
} from '@/components/ui';
import { StockDocumentsListSection } from '@/components/inventory/StockDocumentsListSection';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CustomerSelect } from '@/app/components/form/PartySelect';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import { maybePrintStockDocumentAfterSave } from '@/lib/inventory/stock-document-print-after-save';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryWarehouseDocHeaderFormSchema,
  inventoryReceiptLineSchema,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import {
  postNamedDocumentAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  postSuccessMessage,
  useDocumentPostMutation,
} from '@/lib/inventory/use-document-post-mutation';
import { printStockDocument } from '@/lib/print/printStockDocument';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import {
  ItemReservationDocumentPanel,
  type ApplyReservationPayload,
} from '@/components/inventory/reservations/ItemReservationDocumentPanel';
import {
  useStoreDocumentSerial,
  STORE_DOCUMENT_UNPOSTED_LABEL,
} from '@/lib/inventory/use-store-document-serial';
import { useIssueTourPrepare } from '@/lib/onboarding/useIssueTourPrepare';
import { consumeAiTransactionDraft } from '@/lib/ai/ai-draft-storage';
import { invoiceDateFromDraft, issueLinesFromAiDraft } from '@/lib/ai/hydrate-ai-draft';
import { expiryBatchLinesValid } from '@/lib/invoices/validateExpiryBatchLines';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import {
  mapSourcePayloadToStockLines,
  stockHeaderFieldsFromSource,
} from '@/lib/inventory/apply-source-to-stock-document';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { useDocumentFollowUpHydrate } from '@/lib/hooks/useDocumentFollowUpHydrate';
import { toast } from '@/lib/feedback/toast';
import { useStockMovementPanel } from '@/lib/inventory/use-stock-movement-panel';
import type { TransactionSettings } from '@/lib/transaction-settings/types';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { isUnsetOrDefaultWarehouse } from '@/lib/drafts/form-lines-draft';
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/lib/datetime/local-datetime';


interface Item {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface IssueDocumentDetail extends Record<string, unknown> {
  serialNumber?: string;
  serial?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  warehouseId?: string;
  customerId?: string;
  record?: string;
  isPosted?: boolean;
  isApproved?: boolean;
  isCancelled?: boolean;
  useBarcode?: boolean;
  hideExistingQty?: boolean;
  lines?: Record<string, unknown>[];
}

const issueHeaderSchema = inventoryWarehouseDocHeaderFormSchema.extend({
  customerId: z.string().optional(),
});
type IssueHeaderForm = z.infer<typeof issueHeaderSchema>;

type IssueDraft = { form: IssueHeaderForm; lines: StockVoucherLine[] };

function isIssueDraftEmpty(draft: IssueDraft, defaultWarehouseId?: string | null): boolean {
  const hasLine = draft.lines.some(
    (line) => line.itemId || line.quantity > 0 || (line.unitPrice ?? 0) > 0
  );
  const f = draft.form;
  return (
    !hasLine &&
    isUnsetOrDefaultWarehouse(f.warehouseId, defaultWarehouseId) &&
    !f.customerId?.trim() &&
    !f.description?.trim() &&
    !f.record?.trim()
  );
}

function emptyIssueFormDefaults(): IssueHeaderForm {
  return {
    serialNumber: '',
    description: '',
    date: toDatetimeLocalValue(),
    hijriDate: '',
    warehouseId: '',
    customerId: '',
    record: '',
    isPosted: false,
    isApproved: false,
    useBarcode: true,
    hideExistingQty: false,
  };
}

export default function IssuePage() {
  return (
    <DocumentModeProvider>
      <IssuePageInner />
    </DocumentModeProvider>
  );
}

function IssuePageInner() {
  const searchParams = useOwnTabSearchParams();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  useIssueTourPrepare();
  const invalidateQuery = useInvalidateQuery();

  const inputCls = compactControlClass;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<IssueHeaderForm>({
    resolver: zodResolver(issueHeaderSchema) as Resolver<IssueHeaderForm>,
    defaultValues: emptyIssueFormDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const watchedForm = watch();
  const warehouseId = watch('warehouseId');
  const issueSerial = watch('serialNumber');
  const hideExistingQty = watch('hideExistingQty');
  const skipServerHydrateRef = useRef(false);

  const [issueLines, setIssueLines] = useState<StockVoucherLine[]>(() => seedStockVoucherLines());
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restorePending, setRestorePending] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );

  const setSerialNumber = useCallback(
    (value: string) =>
      setValue('serialNumber', value, { shouldDirty: false, shouldValidate: false }),
    [setValue]
  );
  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'issue',
    enabled: !selectedIssueId,
    setSerial: setSerialNumber,
  });

  const fromAiDraft = searchParams.get('fromAiDraft') === '1';
  const aiDraftAppliedRef = useRef(false);
  const postAfterSaveRef = useRef(false);

  const { data: stockIssueSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'STOCK_ISSUE'],
    '/transaction-settings/STOCK_ISSUE'
  );
  const stockTxSettings = stockIssueSettingsRes?.data;
  const autoPostOnSave = stockTxSettings?.autoPostOnSave === true;
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost(
    autoPostOnSave
  );

  useEffect(() => {
    if (selectedIssueId || !stockTxSettings?.defaultWarehouseId || warehouseId) return;
    setValue('warehouseId', stockTxSettings.defaultWarehouseId, { shouldDirty: false });
  }, [selectedIssueId, setValue, stockTxSettings?.defaultWarehouseId, warehouseId]);

  useEffect(() => {
    if (!selectedIssueId) {
      setMode('create');
      return;
    }
    if (isPosted) lockToView();
    else setMode('edit');
  }, [isPosted, lockToView, selectedIssueId, setMode]);

  useEffect(() => {
    if (aiDraftAppliedRef.current || !fromAiDraft || selectedIssueId) return;
    const draft = consumeAiTransactionDraft('DRAFT_STOCK_ISSUE');
    if (!draft) return;
    aiDraftAppliedRef.current = true;
    const payload = draft.draftPayload;
    reset({
      ...emptyIssueFormDefaults(),
      warehouseId: String(payload.warehouseId ?? ''),
      description: typeof payload.description === 'string' ? payload.description : '',
      date: invoiceDateFromDraft(payload),
    });
    setIssueLines(issueLinesFromAiDraft(payload));
    pinDocumentTabQuery(null);
  }, [fromAiDraft, reset, selectedIssueId]);

  const openIssue = (id: string | null) => {
    setSelectedIssueId(id);
    pinDocumentTabQuery(id);
  };

  useEffect(() => {
    const id = searchParams.get('id')?.trim() || null;
    setSelectedIssueId((prev) => (prev === id ? prev : id));
  }, [searchParams]);
  const [showList, setShowList] = useState(false);

  // Fetch items
  const { isLoading: itemsLoading, data: itemsCatalogResponse } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const catalogItems = itemsCatalogResponse?.data ?? [];
  // Fetch single issue for editing
  const { data: issueResponse } = useApiQuery<IssueDocumentDetail>(
    ['issue', selectedIssueId],
    `/inventory/issues/${selectedIssueId}`,
    undefined,
    { enabled: !!selectedIssueId }
  );
  const selectedIssue = issueResponse?.data;

  const draftSnapshot = useMemo<IssueDraft>(
    () => ({ form: watchedForm, lines: issueLines }),
    [watchedForm, issueLines]
  );

  const applyIssueDraft = useCallback(
    (payload: IssueDraft) => {
      skipServerHydrateRef.current = true;
      reset({ ...emptyIssueFormDefaults(), ...payload.form });
      setIssueLines(
        Array.isArray(payload.lines) && payload.lines.length
          ? payload.lines
          : seedStockVoucherLines()
      );
    },
    [reset]
  );

  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'stock-issue',
    mode: selectedIssueId ? 'edit' : 'new',
    documentId: selectedIssueId,
    value: draftSnapshot,
    enabled: !isPosted,
    applyRestore: applyIssueDraft,
    isEmpty: (draft) => isIssueDraftEmpty(draft, stockTxSettings?.defaultWarehouseId),
    restoreMessage: 'تم استعادة مسودة إذن الصرف',
  });

  const stockPanel = useStockMovementPanel(
    selectedIssueId,
    isPosted,
    (selectedIssue as { journalEntryId?: string | null })?.journalEntryId
  );

  // Load issue data when selected
  useEffect(() => {
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    if (selectedIssue) {
      reset({
        serialNumber: selectedIssue.serialNumber || selectedIssue.serial || '',
        description: selectedIssue.description || '',
        date: selectedIssue.date
          ? toDatetimeLocalValue(selectedIssue.date)
          : toDatetimeLocalValue(),
        hijriDate: selectedIssue.hijriDate || '',
        warehouseId: selectedIssue.warehouseId || '',
        customerId: String(selectedIssue.customerId || ''),
        record: selectedIssue.record || '',
        isPosted: resolvePostedFlag(selectedIssue),
        isApproved: selectedIssue.isApproved || false,
        useBarcode: selectedIssue.useBarcode ?? true,
        hideExistingQty: selectedIssue.hideExistingQty ?? false,
      });
      const loadedLines = (selectedIssue.lines ?? []).map((line: Record<string, unknown>) => ({
        itemId: String(line.itemId ?? ''),
        locationId: String(line.locationId ?? ''),
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        total: Number(line.total || 0),
        itemReservationId: String(line.itemReservationId ?? ''),
        reservationFulfillQuantity: Number(line.reservationFulfillQuantity ?? 0),
        reservationLabel: line.itemReservationId
          ? `حجز ${String(line.reservationFulfillQuantity ?? line.quantity ?? '')}`
          : '',
      }));
      setIssueLines(
        resolvePostedFlag(selectedIssue) ? loadedLines : [...loadedLines, blankStockVoucherLine()]
      );
    }
  }, [selectedIssue, reset]);

  const clearIssueForNext = () => {
    clearDraft();
    openIssue(null);
    stockPanel.resetPanel();
    setIssueLines(seedStockVoucherLines());
    setSourceBarKey((k) => k + 1);
    reset(emptyIssueFormDefaults());
  };

  const issueMutation = useApiMutation<{ id?: string; serial?: string; serialNumber?: string }, Record<string, unknown>>(
    '/inventory/issues',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        const id = res.data?.id;
        const number = res.data?.serialNumber || res.data?.serial;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finish = (posted: boolean) => {
          maybePrintStockDocumentAfterSave(Boolean(stockTxSettings?.autoPrintOnSave), {
            title: 'إذن صرف مخزني',
            number,
            date: watch('date'),
            rows: issueLines.map((line) => ({
              item: line.itemId,
              quantity: line.quantity,
              price: line.unitPrice,
            })),
          });
          finishDocumentSave({
            label: 'إذن صرف مخزني',
            number,
            posted,
            savedId: id,
            onOpen: (saved) => openIssue(saved),
            onSavedOpen: (saved) => invalidateQuery(['issue', saved]),
            reset: clearIssueForNext,
          });
        };
        if (shouldPost && id) {
          void apiClient
            .post(`/inventory/issues/${id}/post`)
            .then((postRes) => {
              setSuccess(postSuccessMessage(postRes));
              setValue('isPosted', true);
              stockPanel.onPosted(postRes);
              invalidateStockViews(invalidateQuery);
              if (id) invalidateQuery(['issue', id]);
              finish(true);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل');
              if (id) openIssue(id);
              invalidateStockViews(invalidateQuery);
            });
          return;
        }
        finish(false);
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const issueUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}` : '/inventory/issues',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        const id = selectedIssueId;
        const number = selectedIssue?.serialNumber || selectedIssue?.serial;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finishSaved = (posted: boolean) => {
          maybePrintStockDocumentAfterSave(Boolean(stockTxSettings?.autoPrintOnSave), {
            title: 'إذن صرف مخزني',
            number,
            date: watch('date'),
            rows: issueLines.map((line) => ({
              item: line.itemId,
              quantity: line.quantity,
              price: line.unitPrice,
            })),
          });
          finishDocumentSave({
            label: 'إذن صرف مخزني',
            number,
            posted,
            savedId: id,
            onOpen: (saved) => openIssue(saved),
            onSavedOpen: (saved) => invalidateQuery(['issue', saved]),
            reset: clearIssueForNext,
          });
        };
        if (consumeShouldRepost() && id) {
          void postNamedDocumentAfterSave(`/inventory/issues/${id}/post`)
            .then(() => {
              stockPanel.onPosted();
              if (id) invalidateQuery(['issue', id]);
              finishSaved(true);
            })
            .catch((error: ApiError) => {
              setError(error.message || 'تم الحفظ لكن تعذر ترحيل الصرف');
            });
          return;
        }
        if (shouldPost && id) {
          void apiClient
            .post(`/inventory/issues/${id}/post`)
            .then((postRes) => {
              setSuccess(postSuccessMessage(postRes));
              setValue('isPosted', true);
              stockPanel.onPosted(postRes);
              invalidateStockViews(invalidateQuery);
              if (id) invalidateQuery(['issue', id]);
              finishSaved(true);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل');
              invalidateStockViews(invalidateQuery);
            });
          return;
        }
        finishSaved(false);
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  const issueCancelMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}/cancel` : '/inventory/issues',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setSuccess('تم إلغاء الإذن');
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        if (selectedIssueId) invalidateQuery(['issue', selectedIssueId]);
        setValue('isPosted', false);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'تعذر الإلغاء');
      },
    }
  );

  const unpostIssueMutation = useDocumentPostMutation('/inventory/issues', selectedIssueId, 'unpost');

  const loading =
    issueMutation.isPending ||
    issueUpdateMutation.isPending ||
    issueCancelMutation.isPending ||
    itemsLoading;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (post) {
      requestExplicitPostAfterSave();
      return;
    }
    if (!selectedIssueId) {
      setError('احفظ الإذن أولاً');
      return;
    }
    unpostIssueMutation.mutate(
        {},
        {
          onSuccess: () => {
            setSuccess('تم فك ترحيل الصرف بنجاح');
            setValue('isPosted', false);
            markUnpostedForEdit();
            invalidateStockViews(invalidateQuery);
            if (selectedIssueId) {
              invalidateQuery(['issue', selectedIssueId]);
              invalidateQuery(['inventory-movements-by-doc', selectedIssueId]);
              const jeId = (selectedIssue as { journalEntryId?: string | null })?.journalEntryId;
              if (jeId) invalidateQuery(['journal-entry', jeId]);
            }
          },
          onError: (error: ApiError) => {
            setError(error.message || 'حدث خطأ أثناء فك الترحيل');
          },
        }
      );
  };

  const handleVoid = async () => {
    if (!selectedIssueId) {
      setError('يرجى اختيار صرف أولاً');
      return;
    }
    if (await confirmAction('إلغاء المستند؟ يمكن استعادته من قائمة (...).')) {
      issueCancelMutation.mutate({});
    }
  };

  const handleRestore = async () => {
    if (!selectedIssueId || restorePending) return;
    setRestorePending(true);
    try {
      await restoreCancelledDocument({
        restorePath: `/inventory/issues/${selectedIssueId}/restore`,
        postPath: `/inventory/issues/${selectedIssueId}/post`,
        kind: 'named',
        autoPostOnSave: stockIssueSettingsRes?.data?.autoPostOnSave,
      });
      invalidateQuery(['issue', selectedIssueId]);
      invalidateStockViews(invalidateQuery);
      setSuccess(
        stockIssueSettingsRes?.data?.autoPostOnSave
          ? 'تمت الاستعادة والترحيل'
          : 'تمت الاستعادة — المستند غير مرحّل'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الاستعادة');
    } finally {
      setRestorePending(false);
    }
  };

  // Handle new receipt
  const handleNew = () => {
    resetKeepPosted();
    clearDraft();
    openIssue(null);
    setIssueLines(seedStockVoucherLines());
    setError('');
    setSuccess('');
    reset(emptyIssueFormDefaults());
    setSourceBarKey((k) => k + 1);
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, getValues('description'));
    if (header.customerId) setValue('customerId', header.customerId);
    if (header.warehouseId) setValue('warehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    setIssueLines(mapSourcePayloadToStockLines(payload));
    toast.success(`تم تحميل الإذن من ${payload.sourceNumber}`);
  };

  useDocumentFollowUpHydrate({
    enabled: true,
    isNewDocument: !selectedIssueId,
    onHydrate: handleSourceHydrate,
  });

  const onSaveValid: SubmitHandler<IssueHeaderForm> = (values) => {
    setError('');
    setSuccess('');
    const filledLines = issueLines.filter(
      (line) => line.itemId || line.quantity > 0 || (line.unitPrice ?? 0) > 0
    );
    const linesParsed = z
      .array(inventoryReceiptLineSchema)
      .min(1, 'أدخل صنفاً وكمية في سطر واحد على الأقل')
      .safeParse(filledLines);
    if (!linesParsed.success) {
      postAfterSaveRef.current = false;
      const msg = linesParsed.error.issues[0]?.message;
      setError(msg || 'تحقق من بنود الأصناف');
      return;
    }
    const expiryErr = expiryBatchLinesValid(filledLines, catalogItems);
    if (expiryErr) {
      postAfterSaveRef.current = false;
      setError(expiryErr);
      return;
    }
    const requestBody = {
      serial: values.serialNumber || undefined,
      description: values.description || undefined,
      date: datetimeLocalToIso(values.date),
      hijriDate: values.hijriDate || undefined,
      warehouseId: values.warehouseId,
      customerId: values.customerId?.trim() ? values.customerId.trim() : null,
      record: values.record || undefined,
      isPosted: values.isPosted || false,
      isApproved: values.isApproved || false,
      lines: filledLines.map((line) => ({
        itemId: line.itemId,
        locationId: line.locationId?.trim() ? line.locationId.trim() : undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice || undefined,
        total: line.total || undefined,
        itemReservationId: line.itemReservationId?.trim() ? line.itemReservationId.trim() : undefined,
        reservationFulfillQuantity:
          line.itemReservationId?.trim() && line.reservationFulfillQuantity
            ? line.reservationFulfillQuantity
            : undefined,
      })),
    };
    if (selectedIssueId) {
      issueUpdateMutation.mutate(requestBody);
    } else {
      issueMutation.mutate(requestBody);
    }
  };

  const submitIssue = (postAfterSave: boolean) => {
    if (isPosted || isReadOnly) return;
    postAfterSaveRef.current = postAfterSave;
    void handleSubmit(onSaveValid, onFieldErrors(setError))();
  };

  const requestSaveDraft = () => submitIssue(autoPostOnSave);

  const requestExplicitPostAfterSave = () => submitIssue(true);

  // Add receipt line
  const addIssueLine = () => {
    setIssueLines([...issueLines, blankStockVoucherLine()]);
  };

  const removeIssueLine = (index: number) => {
    const next = issueLines.filter((_, i) => i !== index);
    setIssueLines(next.length ? next : [blankStockVoucherLine()]);
  };

  const patchIssueLine = (index: number, patch: Partial<StockVoucherLine>) => {
    setIssueLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const updateIssueLine = (index: number, field: keyof StockVoucherLine, value: string | number) => {
    const updatedLines = [...issueLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    
    // Calculate total if quantity or unitPrice changed
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(String(value)) || 0 : updatedLines[index].quantity || 0;
      const unitPrice = field === 'unitPrice' ? parseFloat(String(value)) || 0 : updatedLines[index].unitPrice || 0;
      updatedLines[index].total = quantity * unitPrice;
    }
    if (field === 'quantity' && updatedLines[index].itemReservationId) {
      const q = parseFloat(String(value)) || 0;
      updatedLines[index].reservationFulfillQuantity = Math.min(
        q,
        updatedLines[index].reservationFulfillQuantity || q
      );
    }
    
    setIssueLines(updatedLines);
  };

  const applyReservationToIssue = ({ reservation, quantity }: ApplyReservationPayload) => {
    const label = reservation.itemSerial
      ? `${reservation.itemSerial} — ${reservation.itemName}`
      : reservation.itemName;
    const next = issueLines.filter((line) => line.itemId || line.quantity > 0);
    next.push({
      ...blankStockVoucherLine(),
      itemId: reservation.itemId,
      quantity,
      reservationFulfillQuantity: quantity,
      itemReservationId: reservation.id,
      reservationLabel: `حجز: ${label} (${quantity})`,
      unitPrice: 0,
      total: 0,
    });
    setIssueLines([...next, blankStockVoucherLine()]);
  };

  // Calculate totals
  const totalAmount = issueLines.reduce((sum, line) => sum + (line.total || 0), 0);

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      <PageDraftRestoreGate<IssueDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedIssueId)}
        message="يوجد مسودة إذن صرف غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyIssueDraft(payload);
          setSuccess('تم استعادة مسودة إذن الصرف');
        }}
      />

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'إذن صرف مخزني' },
        ]}
        title="إذن صرف مخزني"
        docNumber={watch('serialNumber') || ''}
        lifecycle={{
          documentId: selectedIssueId,
          isPosted,
          isCancelled: Boolean(
            (selectedIssue as { isCancelled?: boolean } | undefined)?.isCancelled
          ),
        }}
        saveLabel={autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : 'حفظ'}
        onSaveDraft={requestSaveDraft}
        onCancel={handleNew}
        cancelLabel="تراجع"
        onPost={() => handlePostUnpost(true)}
        savePending={loading}
        postPending={loading}
        canPost={!isPosted && !isReadOnly}
        canSave={!isReadOnly && !isPosted}
        hideStandalonePost
        navEntity="issue"
        currentId={selectedIssueId}
        onNavigate={openIssue}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        standardActions={{
          hasDocument: Boolean(selectedIssueId),
          isPosted,
          isCancelled: Boolean(selectedIssue?.isCancelled),
          onRestore: selectedIssueId ? () => void handleRestore() : undefined,
          restoreLabel: 'استعادة',
          restorePending,
          onEdit: () => {
            if (isPosted) {
              setError('يجب إلغاء الترحيل أولاً للتعديل');
              return;
            }
            unlockForEdit();
          },
          onPost: () => handlePostUnpost(true),
          onUnpost: () => handlePostUnpost(false),
          onVoid: handleVoid,
          voidPending: issueCancelMutation.isPending,
          onNew: handleNew,
          newLabel: 'جديد',
          transactionSettingsDocumentType: 'STOCK_ISSUE',
          onTransactionSettingsSaved: () => {
            invalidateAfterTransactionSettingsSave(invalidateQuery, 'STOCK_ISSUE');
            invalidateNextSerial();
          },
        }}
        printTrigger={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={formActionButtonClass}
            onClick={() =>
              printStockDocument({
                title: 'إذن صرف مخزني',
                number: watch('serialNumber'),
                date: watch('date'),
                rows: issueLines.map((line) => ({
                  item: line.itemId,
                  quantity: line.quantity,
                  price: line.unitPrice,
                })),
              })
            }
          >
            طباعة
          </Button>
        }
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أذون الصرف المخزنية السابقة">
        <StockDocumentsListSection
          title=""
          apiPath="/inventory/issues"
          listKey="issues"
          variant="issue"
          selectedId={selectedIssueId}
          onSelect={(id) => {
            openIssue(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />
      <DocumentFormLock>
      <FormSectionCard
        title="بيانات الإذن"
        subtitle="المخزن والعميل والتاريخ"
        sourceActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={issueLines.some((l) => Boolean(l.itemId))}
            disabled={isPosted || isReadOnly}
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
          <CompactFormField label="العميل" error={errors.customerId?.message}>
            <Controller
              name="customerId"
              control={control}
              render={({ field }) => (
                <CustomerSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={`${inputCls} ${errors.customerId ? 'border-red-400' : ''}`}
                  emptyLabel="اختر العميل"
                  disabled={isReadOnly}
                />
              )}
            />
          </CompactFormField>
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" {...register('description')} />
      </FormSectionCard>
      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CompactFormField label="رقم القيد" placeholder="إدخل رقم القيد" {...register('record')} />
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

      <ItemReservationDocumentPanel
        warehouseId={warehouseId}
        disabled={isReadOnly}
        onApply={applyReservationToIssue}
      />

      <FormSectionCard title="بنود الصرف" subtitle="الصنف والكمية والسعر والإجمالي" bodyClassName="space-y-3">
          <StockVoucherLinesGrid
            lines={issueLines}
            warehouseId={warehouseId}
            hideExistingQty={hideExistingQty}
            priceLabel="السعر"
            readOnly={isReadOnly}
            itemsLoading={itemsLoading}
            onAdd={addIssueLine}
            onRemove={removeIssueLine}
            onChange={updateIssueLine}
            onPatchLine={patchIssueLine}
          />
      </FormSectionCard>
      </DocumentFormLock>

      {isReadOnly ? null : (
      <FormStickyFooter
        status={`${issueLines.length} بند · ${totalAmount.toLocaleString('ar-EG')} ج.م`}
      />
      )}

      <StockMovementBottomSplit
        totalAmount={totalAmount}
        lineCount={issueLines.length}
        stockMovementsTabLabel="التأثير المخزني"
        movementSourceFallback={
          issueSerial?.trim() ? { sourceType: 'GI', sourceNumber: issueSerial.trim() } : null
        }
        {...stockPanel.bottomSplitProps}
      />
    </ErpDocumentLayout>
  );
}

