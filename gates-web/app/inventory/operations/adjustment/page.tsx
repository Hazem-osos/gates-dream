'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErpDocumentLayout, ErpDocumentPageHeader, DocumentBrowseDrawer } from '@/components/erp';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
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
import { confirmAction } from '@/lib/feedback/confirm';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryWarehouseDocHeaderFormSchema,
  inventoryAdjustmentLineSchema,
  type InventoryWarehouseDocHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { apiClient } from '@/lib/api/client';


interface Item {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface AdjustmentLine {
  itemId: string;
  locationId?: string;
  bookQuantity?: number;
  actualQuantity: number;
  unitPrice?: number;
  adjustmentQuantity?: number;
  adjustmentTotal?: number;
}

type AdjustmentDetail = Record<string, unknown> & {
  serialNumber?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  warehouseId?: string;
  record?: string;
  journalEntryId?: string | null;
  isPosted?: boolean;
  isApproved?: boolean;
  useBarcode?: boolean;
  hideExistingQty?: boolean;
  lines?: Record<string, unknown>[];
};

function emptyAdjustmentFormDefaults(): InventoryWarehouseDocHeaderFormInput {
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
    useBarcode: true,
    hideExistingQty: true,
  };
}

export default function AdjustmentPage() {
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
  } = useForm<InventoryWarehouseDocHeaderFormInput>({
    resolver: zodResolver(inventoryWarehouseDocHeaderFormSchema) as Resolver<InventoryWarehouseDocHeaderFormInput>,
    defaultValues: emptyAdjustmentFormDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const warehouseId = watch('warehouseId');
  const hideExistingQty = watch('hideExistingQty');

  const [adjustmentLines, setAdjustmentLines] = useState<AdjustmentLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showList, setShowList] = useState(false);
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<string | null>(null);

  // Fetch items
  const { data: itemsResponse, isLoading: itemsLoading } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const items = itemsResponse?.data || [];

  // Fetch single adjustment for editing
  const { data: adjustmentResponse } = useApiQuery<AdjustmentDetail>(
    ['adjustment', selectedAdjustmentId],
    `/inventory/adjustments/${selectedAdjustmentId}`,
    undefined,
    { enabled: !!selectedAdjustmentId }
  );
  const selectedAdjustment = adjustmentResponse?.data;

  // Load adjustment data when selected
  useEffect(() => {
    if (selectedAdjustment) {
      reset({
        serialNumber: selectedAdjustment.serialNumber || '',
        description: selectedAdjustment.description || '',
        date: selectedAdjustment.date
          ? new Date(selectedAdjustment.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        hijriDate: selectedAdjustment.hijriDate || '',
        warehouseId: selectedAdjustment.warehouseId || '',
        record: selectedAdjustment.record || '',
        isPosted: selectedAdjustment.isPosted || false,
        isApproved: selectedAdjustment.isApproved || false,
        useBarcode: selectedAdjustment.useBarcode ?? true,
        hideExistingQty: selectedAdjustment.hideExistingQty ?? true,
      });
      if (selectedAdjustment.lines) {
        setAdjustmentLines(
          selectedAdjustment.lines.map((line: Record<string, unknown>) => ({
            itemId: String(line.itemId ?? ''),
            locationId: String(line.locationId ?? ''),
            bookQuantity: Number(line.bookQuantity || 0),
            actualQuantity: Number(line.actualQuantity || 0),
            unitPrice: Number(line.unitPrice || 0),
            adjustmentQuantity: Number(line.adjustmentQuantity || 0),
            adjustmentTotal: Number(line.adjustmentTotal || 0),
          }))
        );
      } else {
        setAdjustmentLines([]);
      }
    }
  }, [selectedAdjustment, reset]);

  // Adjustment create mutation
  const adjustmentMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/adjustments',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['adjustments']);
        handleNew();
        setSuccess('تم حفظ التسوية بنجاح');
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  // Adjustment update mutation
  const adjustmentUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedAdjustmentId ? `/inventory/adjustments/${selectedAdjustmentId}` : '/inventory/adjustments',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['adjustments']);
        handleNew();
        setSuccess('تم تحديث التسوية بنجاح');
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  // Adjustment delete mutation
  const adjustmentDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedAdjustmentId ? `/inventory/adjustments/${selectedAdjustmentId}` : '/inventory/adjustments',
    'DELETE',
    {
      onSuccess: () => {
        setSuccess('تم حذف التسوية بنجاح');
        invalidateQuery(['adjustments']);
        setSelectedAdjustmentId(null);
        setAdjustmentLines([]);
        reset(emptyAdjustmentFormDefaults());
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  // Post adjustment mutation
  const postAdjustmentMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedAdjustmentId ? `/inventory/adjustments/${selectedAdjustmentId}/post` : '/inventory/adjustments',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم ترحيل التسوية بنجاح');
        setValue('isPosted', true);
        invalidateQuery(['adjustments']);
        invalidateQuery(['adjustment', selectedAdjustmentId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  // Unpost adjustment mutation
  const unpostAdjustmentMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedAdjustmentId ? `/inventory/adjustments/${selectedAdjustmentId}/unpost` : '/inventory/adjustments',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم فك ترحيل التسوية بنجاح');
        setValue('isPosted', false);
        invalidateQuery(['adjustments']);
        invalidateQuery(['adjustment', selectedAdjustmentId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء فك الترحيل');
      },
    }
  );

  const loading = adjustmentMutation.isPending || adjustmentUpdateMutation.isPending || adjustmentDeleteMutation.isPending || itemsLoading;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (!selectedAdjustmentId) {
      setError('يرجى اختيار تسوية أولاً');
      return;
    }

    if (post) {
      postAdjustmentMutation.mutate({});
    } else {
      unpostAdjustmentMutation.mutate({});
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedAdjustmentId) {
      setError('يرجى اختيار تسوية أولاً');
      return;
    }

    if (await confirmAction('هل أنت متأكد من حذف هذه التسوية؟')) {
      adjustmentDeleteMutation.mutate({});
    }
  };

  // Handle new adjustment
  const handleNew = () => {
    setSelectedAdjustmentId(null);
    setAdjustmentLines([]);
    setError('');
    setSuccess('');
    reset(emptyAdjustmentFormDefaults());
  };

  const onSaveValid: SubmitHandler<InventoryWarehouseDocHeaderFormInput> = (values) => {
    setError('');
    setSuccess('');
    const linesParsed = z
      .array(inventoryAdjustmentLineSchema)
      .min(1, 'يرجى إضافة أصناف للتسوية')
      .safeParse(adjustmentLines);
    if (!linesParsed.success) {
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
      record: values.record || undefined,
      isPosted: values.isPosted || false,
      isApproved: values.isApproved || false,
      lines: adjustmentLines.map((line) => ({
        itemId: line.itemId,
        locationId: line.locationId || undefined,
        bookQuantity: line.bookQuantity || undefined,
        actualQuantity: line.actualQuantity,
        unitPrice: line.unitPrice || undefined,
        adjustmentQuantity: line.adjustmentQuantity || undefined,
        adjustmentTotal: line.adjustmentTotal || undefined,
      })),
    };
    if (selectedAdjustmentId) {
      adjustmentUpdateMutation.mutate(requestBody);
    } else {
      adjustmentMutation.mutate(requestBody);
    }
  };

  const applyBookQty = useCallback(
    async (index: number, itemId: string, warehouse: string) => {
      if (!itemId || !warehouse) return;
      try {
        const res = await apiClient.get<{ quantityOnHand?: number; availableQuantity?: number }>(
          `/inventory/items/${itemId}/stock-balance`,
          { warehouseId: warehouse }
        );
        const book = Number(res.data?.quantityOnHand ?? res.data?.availableQuantity) || 0;
        setAdjustmentLines((prev) => {
          const next = [...prev];
          const line = next[index];
          if (!line || line.itemId !== itemId) return prev;
          const actual = line.actualQuantity || 0;
          const unitPrice = line.unitPrice || 0;
          next[index] = {
            ...line,
            bookQuantity: book,
            adjustmentQuantity: actual - book,
            adjustmentTotal: Math.abs(actual - book) * unitPrice,
          };
          return next;
        });
      } catch {
        // keep the entered book qty if live stock is unavailable
      }
    },
    []
  );

  const prevWarehouseRef = useRef(warehouseId);
  useEffect(() => {
    const prev = prevWarehouseRef.current;
    prevWarehouseRef.current = warehouseId;
    if (!warehouseId || prev === warehouseId || !prev) return;
    adjustmentLines.forEach((line, index) => {
      if (line.itemId) void applyBookQty(index, line.itemId, warehouseId);
    });
    // only refill when the user switches the header warehouse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, applyBookQty]);

  // Add adjustment line
  const addAdjustmentLine = () => {
    setAdjustmentLines([...adjustmentLines, {
      itemId: '',
      locationId: '',
      bookQuantity: 0,
      actualQuantity: 0,
      unitPrice: 0,
      adjustmentQuantity: 0,
      adjustmentTotal: 0,
    }]);
  };

  // Remove adjustment line
  const removeAdjustmentLine = (index: number) => {
    setAdjustmentLines(adjustmentLines.filter((_, i) => i !== index));
  };

  // Update adjustment line
  const updateAdjustmentLine = (index: number, field: keyof AdjustmentLine, value: string | number) => {
    const updatedLines = [...adjustmentLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    
    // Calculate adjustment quantity and total
    const bookQty = updatedLines[index].bookQuantity || 0;
    const actualQty = field === 'actualQuantity' ? parseFloat(String(value)) || 0 : updatedLines[index].actualQuantity || 0;
    const unitPrice = field === 'unitPrice' ? parseFloat(String(value)) || 0 : updatedLines[index].unitPrice || 0;
    
    updatedLines[index].adjustmentQuantity = actualQty - bookQty;
    updatedLines[index].adjustmentTotal = Math.abs(updatedLines[index].adjustmentQuantity || 0) * unitPrice;
    
    setAdjustmentLines(updatedLines);
    if (field === 'itemId' && warehouseId && value) {
      void applyBookQty(index, String(value), warehouseId);
    }
  };

  // Calculate totals
  const totalAdjustment = adjustmentLines.reduce((sum, line) => sum + (line.adjustmentTotal || 0), 0);

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'تسوية مخزنية' },
        ]}
        title="تسوية مخزنية"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : 'مسودة'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSubmit(onSaveValid, onFieldErrors(setError))()}
        savePending={loading}
        canSave={!isPosted}
        hideStandalonePost
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        currentId={selectedAdjustmentId}
        favoriteHref="/inventory/operations/adjustment"
        standardActions={{
          hasDocument: Boolean(selectedAdjustmentId),
          isPosted,
          onEdit: () => {
            if (isPosted) setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
          },
          onPost: () => void handlePostUnpost(true),
          onUnpost: () => void handlePostUnpost(false),
          onVoid: handleDelete,
          onNew: handleNew,
          newLabel: 'جديد',
          postPending: postAdjustmentMutation.isPending,
          unpostPending: unpostAdjustmentMutation.isPending,
        }}
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="التسويات المخزنية السابقة">
        <GenericRecordsList
          apiPath="/inventory/adjustments"
          listKey="adjustments-browse"
          selectedId={selectedAdjustmentId}
          columns={[
            { id: 'serial', header: 'المسلسل', getValue: (r) => String(r.serialNumber || r.serial || r.id) },
            {
              id: 'date',
              header: 'التاريخ',
              getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
            },
            {
              id: 'warehouse',
              header: 'المخزن',
              getValue: (r) => {
                const w = r.warehouse as { arabicName?: string } | undefined;
                return w?.arabicName || '—';
              },
            },
            {
              id: 'posted',
              header: 'الحالة',
              getValue: (r) => (r.isPosted ? 'مرحّل' : 'مسودة'),
            },
          ]}
          onSelect={(id) => {
            setSelectedAdjustmentId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <FormSectionCard title="بيانات التسوية" subtitle="المخزن والتاريخ والمرجع">
          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
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
                  عدم إظهار الكمية الموجودة
                </label>
              )}
            />
          </div>
        </div>
      </AdvancedFieldsSection>

      <FormSectionCard title="بنود التسوية" subtitle="الصنف والكميات والتكلفة" bodyClassName="space-y-3">
          <div className="flex items-center justify-end">
            <Button type="button" variant="primary" className="gap-2" onClick={addAdjustmentLine}>
              إضافة صنف
            </Button>
          </div>
          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>م</th>
                  <th className={denseThClass}>الصنف</th>
                  {hideExistingQty ? null : <th className={denseThClass}>الكمية الدفترية</th>}
                  <th className={denseThClass}>الكمية الفعلية</th>
                  <th className={denseThClass}>كمية التسوية</th>
                  <th className={denseThClass}>السعر</th>
                  <th className={denseThClass}>إجمالي التسوية</th>
                  <th className={denseThClass}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {adjustmentLines.length === 0 ? (
                  <tr className={denseTrClass}>
                    <td colSpan={hideExistingQty ? 7 : 8} className={`${denseTdClass} py-8 text-center text-slate-500`}>
                      لا توجد أصناف. اضغط على &quot;إضافة صنف&quot; لإضافة صنف جديد.
                    </td>
                  </tr>
                ) : (
                  adjustmentLines.map((line, index) => (
                    <tr key={index} className={denseTrClass}>
                      <td className={denseTdClass}>{index + 1}</td>
                      <td className={denseTdClass}>
                        <select
                          className={inputCls}
                          value={line.itemId}
                          onChange={(e) => updateAdjustmentLine(index, 'itemId', e.target.value)}
                          disabled={itemsLoading}
                        >
                          <option value="">اختر الصنف</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.arabicName} ({item.code})
                            </option>
                          ))}
                        </select>
                      </td>
                      {hideExistingQty ? null : (
                      <td className={denseTdClass}>
                        <TableNumberInput
                          className={inputCls}
                          value={line.bookQuantity}
                          onValueCommit={(n) => updateAdjustmentLine(index, 'bookQuantity', n)}
                        />
                      </td>
                      )}
                      <td className={denseTdClass}>
                        <TableNumberInput
                          className={inputCls}
                          value={line.actualQuantity}
                          onValueCommit={(n) => updateAdjustmentLine(index, 'actualQuantity', n)}
                        />
                      </td>
                      <td className={denseTdClass}>
                        <input
                          type="number"
                          className={`${inputCls} ${(line.adjustmentQuantity || 0) > 0 ? 'bg-green-50' : (line.adjustmentQuantity || 0) < 0 ? 'bg-red-50' : ''}`}
                          value={line.adjustmentQuantity || ''}
                          readOnly
                        />
                      </td>
                      <td className={denseTdClass}>
                        <TableNumberInput
                          className={inputCls}
                          value={line.unitPrice}
                          onValueCommit={(n) => updateAdjustmentLine(index, 'unitPrice', n)}
                        />
                      </td>
                      <td className={denseTdClass}>
                        <input
                          type="number"
                          className={inputCls}
                          value={line.adjustmentTotal || ''}
                          readOnly
                        />
                      </td>
                      <td className={denseTdClass}>
                        <Button type="button" variant="secondary" size="sm" onClick={() => removeAdjustmentLine(index)}>
                          حذف
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </FormSectionCard>

      <FormSectionCard title="الإجمالي" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CompactFormField label="إجمالي التسوية" value={totalAdjustment.toFixed(2)} readOnly />
      </FormSectionCard>

      <FormStickyFooter
        status={`${adjustmentLines.length} بند · ${totalAdjustment.toLocaleString('ar-EG')} ج.م`}
      />

      <StockMovementBottomSplit
        totalAmount={totalAdjustment}
        lineCount={adjustmentLines.length}
        journalEntryId={selectedAdjustment?.journalEntryId}
        documentId={selectedAdjustmentId}
      />
    </ErpDocumentLayout>
  );
}

