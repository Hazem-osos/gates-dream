'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErpDocumentLayout, ErpDocumentPageHeader, DocumentBrowseDrawer } from '@/components/erp';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import {
  FormSectionCard,
  CompactFormField,
  FormStickyFooter,
  Button,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { confirmAction } from '@/lib/feedback/confirm';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { inventoryWarehouseDocHeaderFormSchema } from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  postSuccessMessage,
  useDocumentPostMutation,
} from '@/lib/inventory/use-document-post-mutation';
import { printStockDocument } from '@/lib/print/printStockDocument';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { postStoreDocumentAfterSave } from '@/lib/inventory/post-store-document-after-save';
import {
  useStoreDocumentSerial,
  STORE_DOCUMENT_UNPOSTED_LABEL,
} from '@/lib/inventory/use-store-document-serial';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import { stockHeaderFieldsFromSource } from '@/lib/inventory/apply-source-to-stock-document';
import { STOCK_LINE_COPY_SOURCE_TYPES, type SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';

type AdjustmentType = 'addition' | 'discount';

type OtherAdjLine = {
  itemId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  adjustmentType: AdjustmentType;
};

type OtherAdjustmentDetail = Record<string, unknown> & {
  serial?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  warehouseId?: string;
  isPosted?: boolean;
  isCancelled?: boolean;
  lines?: Array<{
    itemId: string;
    quantity?: number | string;
    unitPrice?: number | string;
    total?: number | string;
    adjustmentType?: string;
    item?: { arabicName?: string; serial?: string };
  }>;
};

type HeaderForm = z.infer<typeof inventoryWarehouseDocHeaderFormSchema>;

function emptyHeaderDefaults(): HeaderForm {
  const t = new Date().toISOString().split('T')[0];
  return {
    serialNumber: '',
    description: '',
    date: t,
    hijriDate: '',
    warehouseId: '',
    record: '',
    isPosted: false,
    isApproved: false,
    useBarcode: false,
    hideExistingQty: false,
  };
}

function blankLine(): OtherAdjLine {
  return {
    itemId: '',
    quantity: 0,
    unitPrice: 0,
    total: 0,
    adjustmentType: 'addition',
  };
}

export default function OtherAdjustmentPage() {
  const searchParams = useOwnTabSearchParams();
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
  } = useForm<HeaderForm>({
    resolver: zodResolver(inventoryWarehouseDocHeaderFormSchema) as Resolver<HeaderForm>,
    defaultValues: emptyHeaderDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const warehouseId = watch('warehouseId');

  const [lines, setLines] = useState<OtherAdjLine[]>([blankLine()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const [sourceBarKey, setSourceBarKey] = useState(0);

  const setSerialNumber = useCallback(
    (value: string) =>
      setValue('serialNumber', value, { shouldDirty: false, shouldValidate: false }),
    [setValue]
  );
  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'other-adjustment',
    enabled: !selectedId,
    setSerial: setSerialNumber,
  });
  const postAfterSaveRef = useRef(false);

  const { data: detailResponse } = useApiQuery<OtherAdjustmentDetail>(
    ['other-adjustment', selectedId],
    `/inventory/other-adjustments/${selectedId}`,
    undefined,
    { enabled: !!selectedId }
  );
  const selected = detailResponse?.data;

  useEffect(() => {
    if (!selected) return;
    reset({
      serialNumber: selected.serial || '',
      description: selected.description || '',
      date: selected.date
        ? new Date(selected.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      hijriDate: selected.hijriDate || '',
      warehouseId: selected.warehouseId || '',
      record: '',
      isPosted: resolvePostedFlag(selected),
      isApproved: false,
      useBarcode: false,
      hideExistingQty: false,
    });
    setLines(
      (selected.lines ?? []).map((line) => ({
        itemId: String(line.itemId ?? ''),
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        total: Number(line.total) || 0,
        adjustmentType: (line.adjustmentType === 'discount' ? 'discount' : 'addition') as AdjustmentType,
      }))
    );
  }, [selected, reset]);

  const openDoc = (id: string | null) => {
    setSelectedId(id);
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };

  const clearForNew = () => {
    openDoc(null);
    setLines([blankLine()]);
    reset(emptyHeaderDefaults());
    void invalidateNextSerial();
    setSourceBarKey((k) => k + 1);
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, watch('description'));
    if (header.warehouseId) setValue('warehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    setLines(
      payload.lines.length
        ? payload.lines.map((line) => {
            const qty = line.quantity || 0;
            const price = line.unitPrice || 0;
            return {
              itemId: line.itemId,
              quantity: qty,
              unitPrice: price,
              total: qty * price,
              adjustmentType: 'addition' as AdjustmentType,
            };
          })
        : [blankLine()]
    );
    toast.success(`تم تحميل البنود من ${payload.sourceNumber}`);
  };

  const formLocked = Boolean(selectedId);

  const createMutation = useApiMutation<
    { id?: string; serial?: string },
    Record<string, unknown>
  >('/inventory/other-adjustments', 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      invalidateStockViews(invalidateQuery);
      invalidateNextSerial();
      const id = res.data?.id;
      const number = res.data?.serial;
      const shouldPost = postAfterSaveRef.current;
      postAfterSaveRef.current = false;
      const finish = (posted: boolean) => {
        finishDocumentSave({
          label: 'إضافة/خصم',
          number,
          posted,
          savedId: id,
          cleared: false,
          onOpen: openDoc,
          onSavedOpen: (saved) => invalidateQuery(['other-adjustment', saved]),
          reset: () => {
            if (id) openDoc(id);
          },
        });
      };
      if (shouldPost && id) {
        void postStoreDocumentAfterSave({
          postPath: `/inventory/other-adjustments/${id}/post`,
          onPosted: () => {
            setValue('isPosted', true);
            invalidateStockViews(invalidateQuery);
            finish(true);
          },
          onPostFailed: (message) => {
            setError(message);
            openDoc(id);
            invalidateQuery(['other-adjustment', id]);
          },
        });
        return;
      }
      finish(false);
    },
    onError: (err: ApiError) => {
      postAfterSaveRef.current = false;
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const postMutation = useDocumentPostMutation(
    '/inventory/other-adjustments',
    selectedId,
    'post'
  );
  const unpostMutation = useDocumentPostMutation(
    '/inventory/other-adjustments',
    selectedId,
    'unpost'
  );

  const cancelMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/other-adjustments/${selectedId}/cancel` : '/inventory/other-adjustments',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إلغاء المستند');
        invalidateQuery(['other-adjustment', selectedId]);
        clearForNew();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الإلغاء'),
    }
  );

  const updateLine = (index: number, patch: Partial<OtherAdjLine>) => {
    setLines((prev) => {
      const next = [...prev];
      const row = { ...next[index], ...patch };
      const qty = patch.quantity !== undefined ? patch.quantity : row.quantity;
      const price = patch.unitPrice !== undefined ? patch.unitPrice : row.unitPrice;
      row.total = Math.abs(qty) * (price || 0);
      next[index] = row;
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const onSaveValid: SubmitHandler<HeaderForm> = (values) => {
    if (formLocked) {
      postAfterSaveRef.current = false;
      setError('لا يمكن تعديل مستند محفوظ — أنشئ مستنداً جديداً');
      return;
    }
    setError('');
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (validLines.length === 0) {
      postAfterSaveRef.current = false;
      setError('أضف بنداً واحداً على الأقل بصنف وكمية');
      return;
    }
    createMutation.mutate({
      serial: values.serialNumber || undefined,
      description: values.description || undefined,
      date: new Date(values.date).toISOString(),
      warehouseId: values.warehouseId,
      lines: validLines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice || undefined,
        total: line.total || undefined,
        adjustmentType: line.adjustmentType,
      })),
    });
  };

  const requestPostAfterSave = () => {
    if (isPosted) return;
    postAfterSaveRef.current = true;
    void handleSubmit(onSaveValid, onFieldErrors(setError))();
  };

  const handlePostUnpost = async (post: boolean) => {
    if (post) {
      if (!selectedId) {
        requestPostAfterSave();
        return;
      }
      postMutation.mutate(
        {},
        {
          onSuccess: (res) => {
            setSuccess(postSuccessMessage(res));
            setValue('isPosted', true);
            invalidateStockViews(invalidateQuery);
            if (selectedId) invalidateQuery(['other-adjustment', selectedId]);
          },
          onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الترحيل'),
        }
      );
      return;
    }
    if (!selectedId) {
      setError('احفظ المستند أولاً');
      return;
    }
    unpostMutation.mutate(
      {},
      {
        onSuccess: () => {
          setSuccess('تم فك ترحيل المستند بنجاح');
          setValue('isPosted', false);
          invalidateStockViews(invalidateQuery);
          if (selectedId) invalidateQuery(['other-adjustment', selectedId]);
        },
        onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء فك الترحيل'),
      }
    );
  };

  const handleCancel = async () => {
    if (!selectedId) return;
    if (isPosted) {
      setError('فك الترحيل قبل الإلغاء');
      return;
    }
    if (await confirmAction('إلغاء هذا المستند؟')) cancelMutation.mutate({});
  };

  const totalAmount = lines.reduce((s, l) => s + (l.total || 0), 0);
  const loading = createMutation.isPending;

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'إضافات وخصومات أخرى' },
        ]}
        title="إضافات وخصومات أخرى"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL}
        saveLabel={STORE_SAVE_AND_POST_LABEL}
        onSaveDraft={requestPostAfterSave}
        savePending={loading}
        canSave={!formLocked && !isPosted}
        hideStandalonePost
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        currentId={selectedId}
        favoriteHref="/inventory/operations/other-adjustment"
        standardActions={{
          hasDocument: Boolean(selectedId),
          isPosted,
          onEdit: () => setError('لا يتوفر تعديل بعد الحفظ — أنشئ مستنداً جديداً إن لزم'),
          onPost: () => void handlePostUnpost(true),
          onUnpost: () => void handlePostUnpost(false),
          onVoid: () => void handleCancel(),
          onNew: clearForNew,
          newLabel: 'جديد',
          postPending: postMutation.isPending,
          unpostPending: unpostMutation.isPending,
        }}
        extraActions={
          <div className="flex flex-wrap items-end justify-end gap-2">
            <DocumentSourceLoadBar
              key={sourceBarKey}
              hasExistingLines={lines.some((l) => Boolean(l.itemId))}
              disabled={formLocked || isPosted}
              allowedTypes={STOCK_LINE_COPY_SOURCE_TYPES}
              onHydrate={handleSourceHydrate}
            />
            <button
              type="button"
              className="rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm text-[#0A3D5E]"
              onClick={() =>
                printStockDocument({
                  title: 'إضافات وخصومات أخرى',
                  number: watch('serialNumber'),
                  date: watch('date'),
                  rows: lines.map((line) => ({
                    item: line.itemId,
                    quantity: line.quantity,
                    price: line.unitPrice,
                  })),
                })
              }
            >
              طباعة
            </button>
          </div>
        }
      />

      <form className="flex flex-1 flex-col gap-3 px-1 pb-24">
        <FormSectionCard title="بيانات المستند">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <CompactFormField label="المسلسل" error={errors.serialNumber?.message}>
              <input
                className={inputCls}
                placeholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل رقم المسلسل'}
                readOnly={serialAutomatic || formLocked}
                {...register('serialNumber')}
              />
            </CompactFormField>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePickerWithHijri
                  label="التاريخ"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={formLocked}
                />
              )}
            />
            <CompactFormField label="المخزن" error={errors.warehouseId?.message}>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <WarehouseSelect
                    value={field.value}
                    onChange={field.onChange}
                    disabled={formLocked}
                    className={inputCls}
                  />
                )}
              />
            </CompactFormField>
            <CompactFormField label="البيان">
              <input
                className={inputCls}
                disabled={formLocked}
                {...register('description')}
              />
            </CompactFormField>
          </div>
        </FormSectionCard>

        <FormSectionCard title="البنود">
          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>النوع</th>
                  <th className={denseThClass}>الصنف</th>
                  <th className={denseThClass}>الكمية</th>
                  <th className={denseThClass}>سعر الوحدة</th>
                  <th className={denseThClass}>الإجمالي</th>
                  <th className={denseThClass} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className={denseTrClass}>
                    <td className={denseTdClass}>
                      <select
                        className={inputCls}
                        disabled={formLocked}
                        value={line.adjustmentType}
                        onChange={(e) =>
                          updateLine(index, {
                            adjustmentType: e.target.value as AdjustmentType,
                          })
                        }
                      >
                        <option value="addition">إضافة</option>
                        <option value="discount">خصم</option>
                      </select>
                    </td>
                    <td className={denseTdClass}>
                      <ItemSelect
                        value={line.itemId}
                        onChange={(id) => updateLine(index, { itemId: id })}
                        disabled={formLocked || !warehouseId}
                        emptyLabel="اختر الصنف..."
                        className={inputCls}
                      />
                    </td>
                    <td className={denseTdClass}>
                      <TableNumberInput
                        value={line.quantity}
                        onValueCommit={(v) => updateLine(index, { quantity: v })}
                        disabled={formLocked}
                        min={0}
                      />
                    </td>
                    <td className={denseTdClass}>
                      <TableNumberInput
                        value={line.unitPrice}
                        onValueCommit={(v) => updateLine(index, { unitPrice: v })}
                        disabled={formLocked}
                        min={0}
                      />
                    </td>
                    <td className={denseTdClass}>{line.total.toFixed(2)}</td>
                    <td className={denseTdClass}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={formLocked || lines.length <= 1}
                        onClick={() => removeLine(index)}
                      >
                        حذف
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!formLocked && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addLine}>
              إضافة بند
            </Button>
          )}
        </FormSectionCard>

        <FormStickyFooter
          status={`${lines.length} بند · ${totalAmount.toLocaleString('ar-EG')}`}
        />
      </form>

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="مستندات سابقة">
        <GenericRecordsList
          apiPath="/inventory/other-adjustments"
          listKey="other-adjustments-browse"
          selectedId={selectedId}
          columns={[
            { id: 'serial', header: 'المسلسل', getValue: (r) => String(r.serial ?? '—') },
            {
              id: 'date',
              header: 'التاريخ',
              getValue: (r) =>
                r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—',
            },
            {
              id: 'posted',
              header: 'الحالة',
              getValue: (r) => (r.isPosted ? 'مرحّل' : STORE_DOCUMENT_UNPOSTED_LABEL),
            },
          ]}
          onSelect={(id) => {
            openDoc(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}
