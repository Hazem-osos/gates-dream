'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  useBarcode?: boolean;
  hideExistingQty?: boolean;
  lines?: Record<string, unknown>[];
}

const issueHeaderSchema = inventoryWarehouseDocHeaderFormSchema.extend({
  customerId: z.string().optional(),
});
type IssueHeaderForm = z.infer<typeof issueHeaderSchema>;

function emptyIssueFormDefaults(): IssueHeaderForm {
  const t = new Date().toISOString().split('T')[0];
  return {
    serialNumber: '',
    description: '',
    date: t,
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
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
  useIssueTourPrepare();
  const invalidateQuery = useInvalidateQuery();

  const inputCls = compactControlClass;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<IssueHeaderForm>({
    resolver: zodResolver(issueHeaderSchema) as Resolver<IssueHeaderForm>,
    defaultValues: emptyIssueFormDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const warehouseId = watch('warehouseId');
  const hideExistingQty = watch('hideExistingQty');

  const [issueLines, setIssueLines] = useState<StockVoucherLine[]>(() => seedStockVoucherLines());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    window.history.replaceState(null, '', window.location.pathname);
  }, [fromAiDraft, reset, selectedIssueId]);

  const openIssue = (id: string | null) => {
    setSelectedIssueId(id);
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };
  const [showList, setShowList] = useState(false);

  // Fetch items
  const { isLoading: itemsLoading } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  // Fetch single issue for editing
  const { data: issueResponse } = useApiQuery<IssueDocumentDetail>(
    ['issue', selectedIssueId],
    `/inventory/issues/${selectedIssueId}`,
    undefined,
    { enabled: !!selectedIssueId }
  );
  const selectedIssue = issueResponse?.data;

  // Load receipt data when selected
  useEffect(() => {
    if (selectedIssue) {
      reset({
        serialNumber: selectedIssue.serialNumber || selectedIssue.serial || '',
        description: selectedIssue.description || '',
        date: selectedIssue.date
          ? new Date(selectedIssue.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
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
    openIssue(null);
    setIssueLines(seedStockVoucherLines());
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
              invalidateStockViews(invalidateQuery);
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
              invalidateStockViews(invalidateQuery);
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

  const issueDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}` : '/inventory/issues',
    'DELETE',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setSuccess('تم حذف الصرف بنجاح');
        invalidateStockViews(invalidateQuery);
        clearIssueForNext();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  const unpostIssueMutation = useDocumentPostMutation('/inventory/issues', selectedIssueId, 'unpost');

  const loading =
    issueMutation.isPending ||
    issueUpdateMutation.isPending ||
    issueDeleteMutation.isPending ||
    itemsLoading;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (post) {
      requestPostAfterSave();
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
          },
          onError: (error: ApiError) => {
            setError(error.message || 'حدث خطأ أثناء فك الترحيل');
          },
        }
      );
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedIssueId) {
      setError('يرجى اختيار صرف أولاً');
      return;
    }

    if (await confirmAction('هل أنت متأكد من حذف هذا الصرف؟')) {
      issueDeleteMutation.mutate({});
    }
  };

  // Handle new receipt
  const handleNew = () => {
    resetKeepPosted();
    openIssue(null);
    setIssueLines(seedStockVoucherLines());
    setError('');
    setSuccess('');
    reset(emptyIssueFormDefaults());
  };

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
    const requestBody = {
      serial: values.serialNumber || undefined,
      description: values.description || undefined,
      date: new Date(values.date).toISOString(),
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

  const requestPostAfterSave = () => {
    if (isPosted || isReadOnly) return;
    postAfterSaveRef.current = true;
    void handleSubmit(onSaveValid, onFieldErrors(setError))();
  };

  // Add receipt line
  const addIssueLine = () => {
    setIssueLines([...issueLines, blankStockVoucherLine()]);
  };

  const removeIssueLine = (index: number) => {
    const next = issueLines.filter((_, i) => i !== index);
    setIssueLines(next.length ? next : [blankStockVoucherLine()]);
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

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'إذن صرف مخزني' },
        ]}
        title="إذن صرف مخزني"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL}
        saveLabel={STORE_SAVE_AND_POST_LABEL}
        onSaveDraft={requestPostAfterSave}
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
          hasDocument: Boolean(selectedIssueId) || issueLines.some((l) => l.itemId),
          isPosted,
          onEdit: () => {
            if (isPosted) {
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
          <button
            type="button"
            className="rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm text-[#0A3D5E]"
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
          </button>
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
      <FormSectionCard title="بيانات الإذن" subtitle="المخزن والعميل والتاريخ">

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
        journalEntryId={(selectedIssue as { journalEntryId?: string })?.journalEntryId}
        documentId={selectedIssueId}
      />
    </ErpDocumentLayout>
  );
}

