'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import { Plus, Trash2 } from 'lucide-react';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  StatusBadge,
  Button,
  IconButton,
  compactControlClass,
  compactLabelClass,
} from '@/components/ui';
import { StockDocumentsListSection } from '@/components/inventory/StockDocumentsListSection';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryWarehouseDocHeaderFormSchema,
  inventoryReceiptLineSchema,
  type InventoryWarehouseDocHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';


interface Warehouse {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Item {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Location {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface ReceiptLine {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

interface ReceiptDocumentDetail extends Record<string, unknown> {
  serialNumber?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  warehouseId?: string;
  record?: string;
  isPosted?: boolean;
  isApproved?: boolean;
  useBarcode?: boolean;
  hideExistingQty?: boolean;
  lines?: Record<string, unknown>[];
}

function emptyReceiptFormDefaults(): InventoryWarehouseDocHeaderFormInput {
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

export default function ReceiptPage() {
  const invalidateQuery = useInvalidateQuery();

  const inputCls = compactControlClass;
  const labelCls = compactLabelClass;

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
    defaultValues: emptyReceiptFormDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const isApproved = watch('isApproved');

  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  // Fetch warehouses
  const { data: warehousesResponse, isLoading: warehousesLoading } = useApiQuery<Warehouse[]>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = warehousesResponse?.data || [];

  // Fetch items
  const { data: itemsResponse, isLoading: itemsLoading } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const items = itemsResponse?.data || [];

  // Fetch locations (if available)
  const { data: locationsResponse } = useApiQuery<Location[]>(
    ['locations'],
    '/inventory/locations',
    { limit: 1000, isActive: true }
  );
  const locations = locationsResponse?.data || [];

  // Fetch single receipt for editing
  const { data: receiptResponse } = useApiQuery<ReceiptDocumentDetail>(
    ['receipt', selectedReceiptId],
    `/inventory/receipts/${selectedReceiptId}`,
    undefined,
    { enabled: !!selectedReceiptId }
  );
  const selectedReceipt = receiptResponse?.data;

  // Load receipt data when selected
  useEffect(() => {
    if (selectedReceipt) {
      reset({
        serialNumber: selectedReceipt.serialNumber || '',
        description: selectedReceipt.description || '',
        date: selectedReceipt.date
          ? new Date(selectedReceipt.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        hijriDate: selectedReceipt.hijriDate || '',
        warehouseId: selectedReceipt.warehouseId || '',
        record: selectedReceipt.record || '',
        isPosted: selectedReceipt.isPosted || false,
        isApproved: selectedReceipt.isApproved || false,
        useBarcode: selectedReceipt.useBarcode ?? true,
        hideExistingQty: selectedReceipt.hideExistingQty ?? true,
      });
      if (selectedReceipt.lines) {
        setReceiptLines(
          selectedReceipt.lines.map((line: Record<string, unknown>) => ({
            itemId: String(line.itemId ?? ''),
            locationId: String(line.locationId ?? ''),
            quantity: Number(line.quantity || 0),
            unitPrice: Number(line.unitPrice || 0),
            total: Number(line.total || 0),
          }))
        );
      } else {
        setReceiptLines([]);
      }
    }
  }, [selectedReceipt, reset]);

  // Receipt create mutation
  const receiptMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/receipts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الإضافة بنجاح');
        invalidateQuery(['receipts']);
        setSelectedReceiptId(null);
        setReceiptLines([]);
        reset(emptyReceiptFormDefaults());
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  // Receipt update mutation
  const receiptUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReceiptId ? `/inventory/receipts/${selectedReceiptId}` : '/inventory/receipts',
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم تحديث الإضافة بنجاح');
        invalidateQuery(['receipts']);
        invalidateQuery(['receipt', selectedReceiptId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  // Receipt delete mutation
  const receiptDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReceiptId ? `/inventory/receipts/${selectedReceiptId}` : '/inventory/receipts',
    'DELETE',
    {
      onSuccess: () => {
        setSuccess('تم حذف الإضافة بنجاح');
        invalidateQuery(['receipts']);
        setSelectedReceiptId(null);
        setReceiptLines([]);
        reset(emptyReceiptFormDefaults());
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  // Post receipt mutation
  const postReceiptMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReceiptId ? `/inventory/receipts/${selectedReceiptId}/post` : '/inventory/receipts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم ترحيل الإضافة بنجاح');
        setValue('isPosted', true);
        invalidateQuery(['receipts']);
        invalidateQuery(['receipt', selectedReceiptId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  // Unpost receipt mutation
  const unpostReceiptMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReceiptId ? `/inventory/receipts/${selectedReceiptId}/unpost` : '/inventory/receipts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم فك ترحيل الإضافة بنجاح');
        setValue('isPosted', false);
        invalidateQuery(['receipts']);
        invalidateQuery(['receipt', selectedReceiptId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء فك الترحيل');
      },
    }
  );

  const loading = receiptMutation.isPending || receiptUpdateMutation.isPending || receiptDeleteMutation.isPending || warehousesLoading || itemsLoading;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (!selectedReceiptId) {
      setError('يرجى اختيار إضافة أولاً');
      return;
    }

    if (post) {
      postReceiptMutation.mutate({});
    } else {
      unpostReceiptMutation.mutate({});
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (!selectedReceiptId) {
      setError('يرجى اختيار إضافة أولاً');
      return;
    }

    if (window.confirm('هل أنت متأكد من حذف هذه الإضافة؟')) {
      receiptDeleteMutation.mutate({});
    }
  };

  // Handle new receipt
  const handleNew = () => {
    setSelectedReceiptId(null);
    setReceiptLines([]);
    setError('');
    setSuccess('');
    reset(emptyReceiptFormDefaults());
  };

  const onSaveValid: SubmitHandler<InventoryWarehouseDocHeaderFormInput> = (values) => {
    setError('');
    setSuccess('');
    const linesParsed = z
      .array(inventoryReceiptLineSchema)
      .min(1, 'يرجى إضافة أصناف للإضافة')
      .safeParse(receiptLines);
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
      lines: receiptLines.map((line) => ({
        itemId: line.itemId,
        locationId: line.locationId || undefined,
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

  // Add receipt line
  const addReceiptLine = () => {
    setReceiptLines([...receiptLines, {
      itemId: '',
      locationId: '',
      quantity: 0,
      unitPrice: 0,
      total: 0,
    }]);
  };

  // Remove receipt line
  const removeReceiptLine = (index: number) => {
    setReceiptLines(receiptLines.filter((_, i) => i !== index));
  };

  // Update receipt line
  const updateReceiptLine = (index: number, field: keyof ReceiptLine, value: string | number) => {
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
          { label: 'إذن إضافة' },
        ]}
        title="إذن إضافة مخزني"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : 'مسودة'}
        onSaveDraft={() => void handleSubmit(onSaveValid)()}
        onCancel={handleNew}
        cancelLabel="تراجع"
        onPost={() => handlePostUnpost(true)}
        postTriggerId="inventory-receipt.post-click"
        savePending={loading}
        postPending={postReceiptMutation.isPending}
        canPost={!!selectedReceiptId && !isPosted}
        moreMenuItems={[
          { id: 'new', label: 'سند جديد', onClick: handleNew },
          { id: 'del', label: 'حذف', onClick: handleDelete, destructive: true },
        ]}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أذون الإضافة السابقة">
        <StockDocumentsListSection
          title=""
          apiPath="/inventory/receipts"
          listKey="receipts"
          variant="receipt"
          selectedId={selectedReceiptId}
          onSelect={(id) => {
            setSelectedReceiptId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <FormSectionCard title="بيانات الإذن" subtitle="المخزن والتاريخ والمرجع" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#0A3D5E] font-medium">الترحيل:</span>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => handlePostUnpost(true)}
                    disabled={!selectedReceiptId || postReceiptMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${isPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedReceiptId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {postReceiptMutation.isPending ? 'جاري...' : 'ترحيل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostUnpost(false)}
                    disabled={!selectedReceiptId || unpostReceiptMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!isPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedReceiptId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {unpostReceiptMutation.isPending ? 'جاري...' : 'فك ترحيل'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#0A3D5E] font-medium">الموافقة:</span>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setValue('isApproved', true)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${isApproved ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    موافق
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('isApproved', false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!isApproved ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    غير موافق
                  </button>
                </div>
              </div>
            </div>
            <StatusBadge
              variant={isPosted ? 'success' : 'warning'}
              label={isPosted ? 'مرحّل' : 'مسودة'}
            />
          </div>

          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField
            label="التاريخ"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
          <div data-tour-id="receipt-warehouse-select">
            <CompactFormField label="المخزن" error={errors.warehouseId?.message}>
              <select
                className={`${inputCls} ${errors.warehouseId ? 'border-red-400' : ''}`}
                {...register('warehouseId')}
                disabled={warehousesLoading}
              >
                <option value="">اختر المخزن</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.arabicName} ({warehouse.code})
                  </option>
                ))}
              </select>
            </CompactFormField>
          </div>
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

      <div data-tour-id="receipt-lines-card">
      <FormSectionCard title="بنود الإضافة" subtitle="الصنف والكمية والتكلفة" bodyClassName="space-y-3">
          <div className="flex items-center justify-end">
            <Button type="button" variant="primary" className="gap-2" onClick={addReceiptLine}>
              <Plus className="h-4 w-4" aria-hidden />
              إضافة صنف
            </Button>
          </div>
          {receiptLines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">لا توجد أصناف. اضغط «إضافة صنف».</p>
          ) : (
            receiptLines.map((line, index) => (
              <div
                key={`receipt-line-${index}`}
                className="grid grid-cols-1 gap-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-3 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <label className={labelCls}>الصنف</label>
                  <select
                    className={inputCls}
                    value={line.itemId}
                    onChange={(e) => updateReceiptLine(index, 'itemId', e.target.value)}
                    disabled={itemsLoading}
                  >
                    <option value="">اختر الصنف</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.arabicName} ({item.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>الموقع</label>
                  {locations.length > 0 ? (
                    <select
                      className={inputCls}
                      value={line.locationId || ''}
                      onChange={(e) => updateReceiptLine(index, 'locationId', e.target.value)}
                    >
                      <option value="">اختر</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.arabicName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
                <div>
                  <label className={labelCls}>الكمية</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={line.quantity || ''}
                    onChange={(e) => updateReceiptLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className={labelCls}>تكلفة الوحدة</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={line.unitPrice || ''}
                    onChange={(e) => updateReceiptLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <IconButton
                    icon={Trash2}
                    label="حذف السطر"
                    variant="danger"
                    onClick={() => removeReceiptLine(index)}
                  />
                </div>
              </div>
            ))
          )}
      </FormSectionCard>
      </div>

      <FormStickyFooter
        onCancel={handleNew}
        onSave={() => void handleSubmit(onSaveValid)()}
        saveLoading={loading}
        status={`${receiptLines.length} بند · ${totalAmount.toLocaleString('ar-EG')} ج.م`}
      />

      <StockMovementBottomSplit
        totalAmount={totalAmount}
        lineCount={receiptLines.length}
        journalEntryId={(selectedReceipt as { journalEntryId?: string })?.journalEntryId}
        documentId={selectedReceiptId}
      />
    </ErpDocumentLayout>
  );
}

