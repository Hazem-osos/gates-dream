'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import CrudButtons from '@/components/ui/CrudButtons';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  StatusBadge,
  Button,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
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

interface AdjustmentLine {
  itemId: string;
  locationId?: string;
  bookQuantity?: number;
  actualQuantity: number;
  unitPrice?: number;
  adjustmentQuantity?: number;
  adjustmentTotal?: number;
}

interface AdjustmentListItem {
  id: string;
  serialNumber?: string;
  serial?: string;
  date?: string;
  warehouse?: { arabicName?: string };
  isPosted?: boolean;
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
  const isApproved = watch('isApproved');

  const [adjustmentLines, setAdjustmentLines] = useState<AdjustmentLine[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<string | null>(null);

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

  // Fetch adjustments for pagination
  const { data: adjustmentsResponse } = useApiQuery<AdjustmentListItem[]>(
    ['adjustments', String(currentPage), String(isPosted)],
    '/inventory/adjustments',
    { 
      page: currentPage, 
      limit: pageSize,
      isPosted: isPosted ? true : undefined,
    }
  );
  const adjustments = adjustmentsResponse?.data || [];
  const adjustmentsTotal = adjustmentsResponse?.pagination?.total ?? adjustmentsResponse?.meta?.total ?? adjustments.length;

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
        setSuccess('تم حفظ التسوية بنجاح');
        invalidateQuery(['adjustments']);
        setSelectedAdjustmentId(null);
        setAdjustmentLines([]);
        reset(emptyAdjustmentFormDefaults());
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
        setSuccess('تم تحديث التسوية بنجاح');
        invalidateQuery(['adjustments']);
        invalidateQuery(['adjustment', selectedAdjustmentId]);
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

  const loading = adjustmentMutation.isPending || adjustmentUpdateMutation.isPending || adjustmentDeleteMutation.isPending || warehousesLoading || itemsLoading;

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
  const handleDelete = () => {
    if (!selectedAdjustmentId) {
      setError('يرجى اختيار تسوية أولاً');
      return;
    }

    if (window.confirm('هل أنت متأكد من حذف هذه التسوية؟')) {
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
  };

  // Calculate totals
  const totalAdjustment = adjustmentLines.reduce((sum, line) => sum + (line.adjustmentTotal || 0), 0);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {/* Error and Success Toasts */}
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageHeader
        title="تسوية مخزنية"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'الحركات' },
          { label: 'تسوية مخزنية' },
        ]}
        actions={<Pagination page={currentPage} pageSize={pageSize} total={adjustmentsTotal} onPageChange={setCurrentPage} />}
        className="mb-4"
      />

      {/* Adjustments List Section */}
      {adjustments.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A]">
            <h2 className="text-white font-semibold">قائمة التسويات المخزنية</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المسلسل</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المخزن</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الترحيل</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {adjustments.map((adjustment) => (
                  <tr 
                    key={adjustment.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedAdjustmentId === adjustment.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedAdjustmentId(adjustment.id)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{adjustment.serialNumber || adjustment.serial || adjustment.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {adjustment.date ? new Date(adjustment.date).toLocaleDateString('ar-SA') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {adjustment.warehouse?.arabicName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        adjustment.isPosted 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {adjustment.isPosted ? 'مرحل' : 'غير مرحل'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAdjustmentId(adjustment.id);
                        }}
                        className="text-[#0E78AA] hover:text-[#0A5F8A] font-medium"
                      >
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormSectionCard title="بيانات التسوية" subtitle="المخزن والتاريخ والمرجع" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#0A3D5E] font-medium">الترحيل:</span>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => handlePostUnpost(true)}
                    disabled={!selectedAdjustmentId || postAdjustmentMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${isPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedAdjustmentId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {postAdjustmentMutation.isPending ? 'جاري...' : 'ترحيل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostUnpost(false)}
                    disabled={!selectedAdjustmentId || unpostAdjustmentMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!isPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedAdjustmentId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {unpostAdjustmentMutation.isPending ? 'جاري...' : 'فك ترحيل'}
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
          <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3] bg-white">
            <table className="min-w-full text-center border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">م</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">الصنف</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">الموقع</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">الكمية الدفترية</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">الكمية الفعلية</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">كمية التسوية</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">السعر</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">إجمالي التسوية</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {adjustmentLines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-gray-500">
                      لا توجد أصناف. اضغط على &quot;إضافة صنف&quot; لإضافة صنف جديد.
                    </td>
                  </tr>
                ) : (
                  adjustmentLines.map((line, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">{index + 1}</td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
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
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        {locations.length > 0 ? (
                          <select
                            className={inputCls}
                            value={line.locationId || ''}
                            onChange={(e) => updateAdjustmentLine(index, 'locationId', e.target.value)}
                          >
                            <option value="">اختر الموقع</option>
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.arabicName} ({location.code})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          className={inputCls}
                          value={line.bookQuantity || ''}
                          onChange={(e) => updateAdjustmentLine(index, 'bookQuantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          className={inputCls}
                          value={line.actualQuantity || ''}
                          onChange={(e) => updateAdjustmentLine(index, 'actualQuantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          className={`${inputCls} ${(line.adjustmentQuantity || 0) > 0 ? 'bg-green-50' : (line.adjustmentQuantity || 0) < 0 ? 'bg-red-50' : ''}`}
                          value={line.adjustmentQuantity || ''}
                          readOnly
                        />
                      </td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          className={inputCls}
                          value={line.unitPrice || ''}
                          onChange={(e) => updateAdjustmentLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          className={inputCls}
                          value={line.adjustmentTotal || ''}
                          readOnly
                        />
                      </td>
                      <td className="py-3 px-2 border-x border-[#D6EAF3]">
                        <button
                          type="button"
                          onClick={() => removeAdjustmentLine(index)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                          حذف
                        </button>
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
        onCancel={handleNew}
        onSave={() => void handleSubmit(onSaveValid, onFieldErrors(setError))()}
        saveLoading={loading}
        status={`${adjustmentLines.length} بند · ${totalAdjustment.toLocaleString('ar-EG')} ج.م`}
        extraActions={
          <CrudButtons
            onAdd={handleNew}
            onEdit={() => {
              if (!selectedAdjustmentId) {
                setError('يرجى اختيار تسوية للتعديل');
              }
            }}
            onDelete={handleDelete}
            extraItems={[
              { id: 'preview', label: 'معاينة', onClick: () => {} },
              { id: 'design', label: 'تصميم', onClick: () => {} },
            ]}
          />
        }
      />

      <StockMovementBottomSplit
        totalAmount={totalAdjustment}
        lineCount={adjustmentLines.length}
        journalEntryId={selectedAdjustment?.journalEntryId}
        documentId={selectedAdjustmentId}
      />
    </div>
  );
}

