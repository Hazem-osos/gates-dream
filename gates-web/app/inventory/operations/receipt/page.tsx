'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
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
import { SupplierSelect } from '@/app/components/form/PartySelect';
import { AccountSelect } from '@/components/form/AccountSelect';
import type { TransactionSettings } from '@/lib/transaction-settings/types';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import {
  getBranchIdForStoreDocumentSave,
  STORE_SAVE_AND_POST_LABEL,
} from '@/lib/inventory/store-document-save-post';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
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
  useStoreDocumentSerial,
  STORE_DOCUMENT_UNPOSTED_LABEL,
} from '@/lib/inventory/use-store-document-serial';
import { TransactionSettingsDrawer } from '@/components/settings/transaction-settings/TransactionSettingsDrawer';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import {
  mapSourcePayloadToStockLines,
  stockHeaderFieldsFromSource,
} from '@/lib/inventory/apply-source-to-stock-document';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { STOCK_RECEIPT_SOURCE_TYPES } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';
import { useStockMovementPanel } from '@/lib/inventory/use-stock-movement-panel';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';


interface Item {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface ReceiptDocumentDetail extends Record<string, unknown> {
  serialNumber?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  warehouseId?: string;
  supplierId?: string;
  offsetAccountId?: string | null;
  record?: string;
  isPosted?: boolean;
  isApproved?: boolean;
  useBarcode?: boolean;
  hideExistingQty?: boolean;
  lines?: Record<string, unknown>[];
}

const receiptHeaderSchema = inventoryWarehouseDocHeaderFormSchema.extend({
  supplierId: z.string().optional(),
  offsetAccountId: z.string().optional(),
});
type ReceiptHeaderForm = z.infer<typeof receiptHeaderSchema>;

function receiptOffsetAccountForSave(formValue: string, settingsDefault: string): string | null {
  const raw = String(formValue ?? '').trim();
  if (!raw) return null;
  if (raw === String(settingsDefault ?? '').trim()) return null;
  return raw;
}

function emptyReceiptFormDefaults(): ReceiptHeaderForm {
  const t = new Date().toISOString().split('T')[0];
  return {
    serialNumber: '',
    description: '',
    date: t,
    hijriDate: '',
    warehouseId: '',
    supplierId: '',
    offsetAccountId: '',
    record: '',
    isPosted: false,
    isApproved: false,
    useBarcode: true,
    hideExistingQty: false,
  };
}

export default function ReceiptPage() {
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();

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
  } = useForm<ReceiptHeaderForm>({
    resolver: zodResolver(receiptHeaderSchema) as Resolver<ReceiptHeaderForm>,
    defaultValues: emptyReceiptFormDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const warehouseId = watch('warehouseId');
  const hideExistingQty = watch('hideExistingQty');

  const [receiptLines, setReceiptLines] = useState<StockVoucherLine[]>(() => seedStockVoucherLines());
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const openReceipt = (id: string | null) => {
    setSelectedReceiptId(id);
    if (typeof window === 'undefined') return;
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };
  const [showList, setShowList] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setSerialNumber = useCallback(
    (value: string) =>
      setValue('serialNumber', value, { shouldDirty: false, shouldValidate: false }),
    [setValue]
  );
  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'receipt',
    enabled: !selectedReceiptId,
    setSerial: setSerialNumber,
  });
  const postAfterSaveRef = useRef(false);

  const { data: stockReceiptSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'STOCK_RECEIPT'],
    '/transaction-settings/STOCK_RECEIPT'
  );
  const stockReceiptOffsetDefault = stockReceiptSettingsRes?.data?.defaultOffsetAccountId ?? '';

  // Fetch items
  const { isLoading: itemsLoading } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  // Fetch single receipt for editing
  const { data: receiptResponse } = useApiQuery<ReceiptDocumentDetail>(
    ['receipt', selectedReceiptId],
    `/inventory/receipts/${selectedReceiptId}`,
    undefined,
    { enabled: !!selectedReceiptId }
  );
  const selectedReceipt = receiptResponse?.data;
  const stockPanel = useStockMovementPanel(
    selectedReceiptId,
    isPosted,
    (selectedReceipt as { journalEntryId?: string | null })?.journalEntryId
  );

  useEffect(() => {
    if (selectedReceiptId) return;
    const def = stockReceiptOffsetDefault.trim();
    if (!def) return;
    const current = getValues('offsetAccountId')?.trim();
    if (!current) {
      setValue('offsetAccountId', def, { shouldDirty: false, shouldValidate: false });
    }
  }, [selectedReceiptId, stockReceiptOffsetDefault, getValues, setValue]);

  // Load receipt data when selected
  useEffect(() => {
    if (selectedReceipt) {
      const storedOffset = String(selectedReceipt.offsetAccountId ?? '').trim();
      reset({
        serialNumber: String(selectedReceipt.serialNumber || selectedReceipt.serial || ''),
        description: selectedReceipt.description || '',
        date: selectedReceipt.date
          ? new Date(selectedReceipt.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        hijriDate: selectedReceipt.hijriDate || '',
        warehouseId: selectedReceipt.warehouseId || '',
        supplierId: String(selectedReceipt.supplierId || ''),
        offsetAccountId: storedOffset || stockReceiptOffsetDefault,
        record: selectedReceipt.record || '',
        isPosted: resolvePostedFlag(selectedReceipt),
        isApproved: selectedReceipt.isApproved || false,
        useBarcode: selectedReceipt.useBarcode ?? true,
        hideExistingQty: selectedReceipt.hideExistingQty ?? false,
      });
      const loadedLines = (selectedReceipt.lines ?? []).map((line: Record<string, unknown>) => ({
        itemId: String(line.itemId ?? ''),
        locationId: String(line.locationId ?? ''),
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        total: Number(line.total || 0),
      }));
      setReceiptLines(
        resolvePostedFlag(selectedReceipt) ? loadedLines : [...loadedLines, blankStockVoucherLine()]
      );
    }
  }, [selectedReceipt, reset, stockReceiptOffsetDefault]);

  // Receipt create mutation
  const clearReceiptForNext = () => {
    openReceipt(null);
    stockPanel.resetPanel();
    setReceiptLines(seedStockVoucherLines());
    reset(emptyReceiptFormDefaults());
    setSourceBarKey((k) => k + 1);
  };

  const receiptMutation = useApiMutation<{ id?: string; serial?: string; serialNumber?: string }, Record<string, unknown>>(
    '/inventory/receipts',
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
            label: 'إذن إضافة مخزني',
            number,
            posted,
            savedId: id,
            onOpen: (saved) => openReceipt(saved),
            onSavedOpen: (saved) => invalidateQuery(['receipt', saved]),
            reset: clearReceiptForNext,
          });
        };
        if (shouldPost && id) {
          void apiClient
            .post(`/inventory/receipts/${id}/post`)
            .then((postRes) => {
              setSuccess(postSuccessMessage(postRes));
              setValue('isPosted', true);
              stockPanel.onPosted(postRes);
              invalidateStockViews(invalidateQuery);
              if (id) invalidateQuery(['receipt', id]);
              finish(true);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل');
              if (id) openReceipt(id);
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

  // Receipt update mutation
  const receiptUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReceiptId ? `/inventory/receipts/${selectedReceiptId}` : '/inventory/receipts',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        const id = selectedReceiptId;
        const number = String(selectedReceipt?.serialNumber || selectedReceipt?.serial || '');
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finishSaved = (posted: boolean) => {
          finishDocumentSave({
            label: 'إذن إضافة مخزني',
            number,
            posted,
            savedId: id,
            onOpen: (saved) => openReceipt(saved),
            onSavedOpen: (saved) => invalidateQuery(['receipt', saved]),
            reset: clearReceiptForNext,
          });
        };
        if (consumeShouldRepost() && id) {
          void postNamedDocumentAfterSave(`/inventory/receipts/${id}/post`)
            .then(() => {
              stockPanel.onPosted();
              if (id) invalidateQuery(['receipt', id]);
              finishSaved(true);
            })
            .catch((error: ApiError) => {
              setError(error.message || 'تم الحفظ لكن تعذر ترحيل الإضافة');
            });
          return;
        }
        if (shouldPost && id) {
          void apiClient
            .post(`/inventory/receipts/${id}/post`)
            .then((postRes) => {
              setSuccess(postSuccessMessage(postRes));
              setValue('isPosted', true);
              stockPanel.onPosted(postRes);
              invalidateStockViews(invalidateQuery);
              if (id) invalidateQuery(['receipt', id]);
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

  // Receipt delete mutation
  const receiptDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReceiptId ? `/inventory/receipts/${selectedReceiptId}` : '/inventory/receipts',
    'DELETE',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setSuccess('تم حذف الإضافة بنجاح');
        invalidateStockViews(invalidateQuery);
        clearReceiptForNext();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  const unpostReceiptMutation = useDocumentPostMutation(
    '/inventory/receipts',
    selectedReceiptId,
    'unpost'
  );

  const loading =
    receiptMutation.isPending || receiptUpdateMutation.isPending || receiptDeleteMutation.isPending || itemsLoading;

  // Handle delete
  const handleDelete = async () => {
    if (!selectedReceiptId) {
      setError('يرجى اختيار إضافة أولاً');
      return;
    }

    if (await confirmAction('هل أنت متأكد من حذف هذه الإضافة؟')) {
      receiptDeleteMutation.mutate({});
    }
  };

  // Handle new receipt
  const handleNew = () => {
    resetKeepPosted();
    openReceipt(null);
    setReceiptLines(seedStockVoucherLines());
    setError('');
    setSuccess('');
    reset(emptyReceiptFormDefaults());
    setSourceBarKey((k) => k + 1);
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, getValues('description'));
    if (header.supplierId) setValue('supplierId', header.supplierId);
    if (header.warehouseId) setValue('warehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    setReceiptLines(mapSourcePayloadToStockLines(payload));
    toast.success(`تم تحميل الإذن من ${payload.sourceNumber}`);
  };

  const onSaveValid: SubmitHandler<ReceiptHeaderForm> = (values) => {
    setError('');
    setSuccess('');
    const filledLines = receiptLines.filter(
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
    const activeBranchId = getBranchIdForStoreDocumentSave();
    const requestBody = {
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
      serial: values.serialNumber || undefined,
      description: values.description || undefined,
      date: new Date(values.date).toISOString(),
      hijriDate: values.hijriDate || undefined,
      warehouseId: values.warehouseId,
      supplierId: values.supplierId?.trim() ? values.supplierId.trim() : null,
      offsetAccountId: receiptOffsetAccountForSave(
        values.offsetAccountId ?? '',
        stockReceiptOffsetDefault
      ),
      record: values.record || undefined,
      isPosted: values.isPosted || false,
      isApproved: values.isApproved || false,
      lines: filledLines.map((line) => ({
        itemId: line.itemId,
        locationId: line.locationId?.trim() ? line.locationId.trim() : undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice || undefined,
        total: line.total || undefined,
      })),
    };
    if (selectedReceiptId) {
      receiptUpdateMutation.mutate(requestBody);
    } else {
      receiptMutation.mutate(requestBody);
    }
  };

  const requestPostAfterSave = () => {
    if (isPosted) return;
    postAfterSaveRef.current = true;
    void handleSubmit(onSaveValid, onFieldErrors(setError))();
  };

  const handlePostUnpost = async (post: boolean) => {
    if (post) {
      requestPostAfterSave();
      return;
    }
    if (!selectedReceiptId) {
      setError('احفظ الإذن أولاً');
      return;
    }
    unpostReceiptMutation.mutate(
      {},
      {
        onSuccess: () => {
          setSuccess('تم فك ترحيل الإضافة بنجاح');
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

  // Add receipt line
  const addReceiptLine = () => {
    setReceiptLines([...receiptLines, blankStockVoucherLine()]);
  };

  // Remove receipt line
  const removeReceiptLine = (index: number) => {
    const next = receiptLines.filter((_, i) => i !== index);
    setReceiptLines(next.length ? next : [blankStockVoucherLine()]);
  };

  // Update receipt line
  const updateReceiptLine = (index: number, field: keyof StockVoucherLine, value: string | number) => {
    const updatedLines = [...receiptLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    
    // Calculate total if quantity or unitPrice changed
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(String(value)) || 0 : updatedLines[index].quantity || 0;
      const unitPrice = field === 'unitPrice' ? parseFloat(String(value)) || 0 : updatedLines[index].unitPrice || 0;
      updatedLines[index].total = quantity * unitPrice;
    }
    
    setReceiptLines(updatedLines);
  };

  // Calculate totals
  const totalAmount = receiptLines.reduce((sum, line) => sum + (line.total || 0), 0);

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'إذن إضافة مخزني' },
        ]}
        title="إذن إضافة مخزني"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL}
        saveLabel={STORE_SAVE_AND_POST_LABEL}
        onSaveDraft={requestPostAfterSave}
        onCancel={handleNew}
        cancelLabel="تراجع"
        hideStandalonePost
        savePending={loading}
        postPending={loading}
        canPost={!isPosted}
        onPost={() => handlePostUnpost(true)}
        canSave={!isPosted}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        standardActions={{
          hasDocument: Boolean(selectedReceiptId) || receiptLines.some((l) => l.itemId),
          isPosted,
          onEdit: () => {
            if (!selectedReceiptId) return;
            if (isPosted) {
              setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
            }
          },
          onPost: () => handlePostUnpost(true),
          onUnpost: () => handlePostUnpost(false),
          onVoid: handleDelete,
          onNew: handleNew,
          newLabel: 'جديد',
          postPending: loading,
          unpostPending: unpostReceiptMutation.isPending,
          extraItems: [
            { id: 'settings', label: 'إعدادات المستند', onClick: () => setSettingsOpen(true) },
          ],
        }}
        printTrigger={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={formActionButtonClass}
            onClick={() =>
              printStockDocument({
                title: 'إذن إضافة مخزني',
                number: watch('serialNumber'),
                date: watch('date'),
                rows: receiptLines.map((line) => ({
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
        extraActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={receiptLines.some((l) => Boolean(l.itemId))}
            disabled={isPosted}
            allowedTypes={STOCK_RECEIPT_SOURCE_TYPES}
            onHydrate={handleSourceHydrate}
          />
        }
      />

      <TransactionSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        documentType="STOCK_RECEIPT"
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أذون الإضافة المخزنية السابقة">
        <StockDocumentsListSection
          title=""
          apiPath="/inventory/receipts"
          listKey="receipts"
          variant="receipt"
          selectedId={selectedReceiptId}
          onSelect={(id) => {
            openReceipt(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <FormSectionCard title="بيانات الإذن" subtitle="المخزن والمورد والتاريخ">
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
          <div data-tour-id="receipt-warehouse-select">
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
          <CompactFormField label="المورد" error={errors.supplierId?.message}>
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <SupplierSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={`${inputCls} ${errors.supplierId ? 'border-red-400' : ''}`}
                  emptyLabel="اختر المورد"
                />
              )}
            />
          </CompactFormField>
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" {...register('description')} />
          <CompactFormField
            label="الحساب الوسيط (دائن القيد)"
            hint={
              stockReceiptOffsetDefault
                ? 'الافتراضي من إعدادات إذن الإضافة — يمكن تغييره لهذا الإذن فقط'
                : 'حدّد الحساب الوسيط من إعدادات المستند أو اختر حساباً هنا'
            }
          >
            <Controller
              name="offsetAccountId"
              control={control}
              render={({ field }) => (
                <AccountSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  disabled={isPosted}
                  leafOnly
                  className={inputCls}
                  placeholder="الحساب الوسيط"
                />
              )}
            />
          </CompactFormField>
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

      <div data-tour-id="receipt-lines-card">
      <FormSectionCard title="بنود الإضافة" subtitle="الصنف والكمية والتكلفة والإجمالي" bodyClassName="space-y-3">
          <StockVoucherLinesGrid
            lines={receiptLines}
            warehouseId={warehouseId}
            hideExistingQty={hideExistingQty}
            priceLabel="تكلفة الوحدة"
            itemsLoading={itemsLoading}
            onAdd={addReceiptLine}
            onRemove={removeReceiptLine}
            onChange={updateReceiptLine}
          />
      </FormSectionCard>
      </div>

      <FormStickyFooter
        status={`${receiptLines.length} بند · ${totalAmount.toLocaleString('ar-EG')} ج.م`}
      />

      <StockMovementBottomSplit
        totalAmount={totalAmount}
        lineCount={receiptLines.length}
        {...stockPanel.bottomSplitProps}
      />
    </ErpDocumentLayout>
  );
}

