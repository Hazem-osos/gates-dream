'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import CrudButtons from '@/components/ui/CrudButtons';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  StatusBadge,
  compactControlClass,
  compactLabelClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryPurchaseOrderFormSchema,
  inventoryPurchaseOrderHeaderFormSchema,
  type InventoryPurchaseOrderHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';

import { InvoiceFinancialSummary } from '@/components/inventory/InvoiceFinancialSummary';
import { computeInvoiceFinancialSummary } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { simpleInvoiceLineRowCells } from '@/lib/inventory/invoiceLineTableCells';
import { EmptyState } from '@/components/ui/EmptyState';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { SupplierSelect } from '@/components/form/PartySelect';

interface Item {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface PurchaseOrderLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

function emptyPurchaseOrderHeader(today: string): InventoryPurchaseOrderHeaderFormInput {
  return {
    orderNumber: '',
    description: '',
    date: today,
    hijriDate: '',
    supplierId: '',
    warehouseId: '',
    costCenterId: '',
    currencyId: '',
    isPosted: false,
    isApproved: false,
    useBarcode: false,
    hideExistingQty: false,
  };
}

export default function PurchaseOrderPage() {
  const invalidateQuery = useInvalidateQuery();
  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InventoryPurchaseOrderHeaderFormInput>({
    resolver: zodResolver(inventoryPurchaseOrderHeaderFormSchema) as Resolver<InventoryPurchaseOrderHeaderFormInput>,
    defaultValues: emptyPurchaseOrderHeader(todayStr),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');

  const [showCanceled, setShowCanceled] = useState(false);
  const [printEnglishInvoice, setPrintEnglishInvoice] = useState(false);
  const [dontPrintEmptyLines, setDontPrintEmptyLines] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [conditions, setConditions] = useState<string[]>(['الشرط 1']);

  const [orderLines, setOrderLines] = useState<PurchaseOrderLine[]>([]);
  const [showList, setShowList] = useState(false);
  const searchParams = useSearchParams();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => searchParams.get('orderId')?.trim() || null
  );

  const financialSummary = useMemo(
    () =>
      computeInvoiceFinancialSummary(
        orderLines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          taxRate: line.tax,
        })),
        { applyTax: true }
      ),
    [orderLines]
  );

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch currencies
  const { data: currenciesResponse, isLoading: currenciesLoading } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  const { data: itemsResponse } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 2000, isActive: true }
  );
  const items = itemsResponse?.data ?? [];

  const { data: selectedOrderResponse } = useApiQuery<{
    orderNumber?: string | null;
    description?: string | null;
    date?: string;
    hijriDate?: string | null;
    supplierId?: string | null;
    warehouseId?: string | null;
    costCenterId?: string | null;
    currencyId?: string | null;
    currency?: { id?: string } | null;
    isPosted?: boolean;
    isApproved?: boolean;
    lines?: Array<{
      itemId: string;
      quantity?: number | string;
      unitPrice?: number | string;
      discountValue?: number | string;
      taxPercentage?: number | string;
    }>;
  }>(
    ['purchase-order', selectedOrderId ?? ''],
    selectedOrderId ? `/inventory/purchase-orders/${selectedOrderId}` : '/inventory/purchase-orders',
    undefined,
    { enabled: Boolean(selectedOrderId) }
  );

  useEffect(() => {
    const o = selectedOrderResponse?.data;
    if (!o || !selectedOrderId) return;
    reset({
      ...emptyPurchaseOrderHeader(o.date?.slice(0, 10) || todayStr),
      orderNumber: o.orderNumber ?? '',
      description: o.description ?? '',
      date: o.date?.slice(0, 10) || todayStr,
      hijriDate: o.hijriDate ?? '',
      supplierId: o.supplierId ?? '',
      warehouseId: o.warehouseId ?? '',
      costCenterId: o.costCenterId ?? '',
      currencyId: o.currencyId ?? o.currency?.id ?? '',
      isPosted: Boolean(o.isPosted),
      isApproved: Boolean(o.isApproved),
    });
    setOrderLines(
      (o.lines ?? []).map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity ?? 0),
        unitPrice: Number(line.unitPrice ?? 0),
        discount: Number(line.discountValue ?? 0),
        tax: Number(line.taxPercentage ?? 0),
      }))
    );
  }, [selectedOrderResponse, selectedOrderId, reset, todayStr]);

  // Purchase order mutation
  const purchaseOrderMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/purchase-orders',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ أمر الشراء بنجاح');
        invalidateQuery(['purchase-orders']);
        reset(emptyPurchaseOrderHeader(new Date().toISOString().split('T')[0]));
        setOrderLines([]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = purchaseOrderMutation.isPending;

  useEffect(() => {
    reset((prev) => ({ ...prev, date: prev.date || todayStr }));
  }, [todayStr, reset]);

  useEffect(() => {
    if (currencies.length > 0 && !getValues('currencyId')) {
      const defaultCurrency = currencies.find((c) => c.code === 'EGP') || currencies[0];
      setValue('currencyId', defaultCurrency.id);
    }
  }, [currencies, getValues, setValue]);

  const inputCls = compactControlClass;
  const labelCls = compactLabelClass;
  const advancedFilledCount = [watch('hijriDate'), watch('costCenterId')].filter(Boolean).length;

  const addCondition = () => {
    const newCondition = `الشرط ${conditions.length + 1}`;
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (index: number, value: string) => {
    const updatedConditions = [...conditions];
    updatedConditions[index] = value;
    setConditions(updatedConditions);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {/* Error and Success Toasts */}
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageHeader
        title="أمر الشراء"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'الحركات' },
          { label: 'أمر الشراء' },
        ]}
        className="mb-4"
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أوامر الشراء السابقة">
        <GenericRecordsList
          apiPath="/inventory/purchase-orders"
          listKey="purchase-orders-browse"
          paging="skip"
          extraParams={{ isCancelled: showCanceled }}
          selectedId={selectedOrderId}
          columns={[
            {
              id: 'num',
              header: 'الرقم',
              getValue: (r) => String(r.orderNumber ?? r.id.slice(0, 8)),
            },
            {
              id: 'date',
              header: 'التاريخ',
              getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
            },
            {
              id: 'party',
              header: 'المورد',
              getValue: (r) => {
                const s = r.supplier as { arabicName?: string } | undefined;
                return s?.arabicName || '—';
              },
            },
          ]}
          onSelect={(id) => {
            setSelectedOrderId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      {/* View Controls */}
      <div className="mb-6 flex justify-start">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#0A3D5E] font-medium">عرض:</span>
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button 
              onClick={() => setShowCanceled(false)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                !showCanceled ? 'bg-[#0E78AA] text-white' : 'text-gray-600 hover:bg-gray-300'
              }`}
            >
              عرض عادي
            </button>
            <button 
              onClick={() => setShowCanceled(true)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                showCanceled ? 'bg-[#0E78AA] text-white' : 'text-gray-600 hover:bg-gray-300'
              }`}
            >
              عرض الملغي
            </button>
          </div>
          
          {/* Restore Link - Only shows when "عرض الملغي" is selected */}
          {showCanceled && (
            <button className="text-xs text-[#0E78AA] hover:text-[#0E78AA]/80 underline transition-colors mr-2">
              استعادة
            </button>
          )}
        </div>
      </div>

      <FormSectionCard
        title="بيانات أمر الشراء"
        subtitle="المورد والتاريخ والعملة والمخزن"
        bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4"
      >
        <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#0A3D5E] font-medium">الترحيل:</span>
              <Controller
                name="isPosted"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <div className="flex bg-gray-200 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => onChange(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        value ? 'bg-[#0E78AA] text-white' : 'text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      ترحيل
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(false)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        !value ? 'bg-[#0E78AA] text-white' : 'text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      فك ترحيل
                    </button>
                  </div>
                )}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#0A3D5E] font-medium">الاعتماد:</span>
              <Controller
                name="isApproved"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <div className="flex bg-gray-200 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => onChange(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        value ? 'bg-[#0E78AA] text-white' : 'text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      اعتماد
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(false)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        !value ? 'bg-[#0E78AA] text-white' : 'text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      إلغاء اعتماد
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
          <StatusBadge variant={isPosted ? 'success' : 'warning'} label={isPosted ? 'مرحل' : 'غير مرحل'} />
        </div>

        <CompactFormField label="رقم الفاتورة" placeholder="إدخل رقم السند" {...register('orderNumber')} />
        <CompactFormField
          label="التاريخ"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />
        <CompactFormField label="الشرح" placeholder="ادخل الشرح" {...register('description')} />
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
        <CompactFormField label="العملة">
          <select className={inputCls} {...register('currencyId')} disabled={currenciesLoading}>
            <option value="">اختر العملة</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.arabicName} ({currency.code})
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="مركز التكلفة">
            <Controller
              name="costCenterId"
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
          <div className="flex flex-wrap items-end gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-[#0E78AA]/50 text-[#0E78AA]" />
            <label className={`${labelCls} mb-0`}>السماح بالإرجاع خلال</label>
            <input className={`${inputCls} w-20`} defaultValue="365" />
            <span className="text-xs font-semibold text-[#094C6B]">يوم</span>
          </div>
        </div>
      </AdvancedFieldsSection>

      <FormSectionCard title="أصناف أمر الشراء" subtitle="الصنف والكمية والسعر" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
        <div className="overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white [&_input]:h-9 [&_select]:h-9">
          <table className="min-w-full text-center border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">م</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">الصنف</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">الوحدة</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">الكمية</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">الوحدة الأساسية</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">الكمية</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">السعر</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">الإجمالي</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">خصم %</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">خصم قيمة</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md border-r border-white/20">ض. مبيعات %</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-2 px-3 text-xs font-bold shadow-md">قيمتها</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-6">
                    <EmptyState title="لا توجد بنود — أضف أصناف أمر الشراء." />
                  </td>
                </tr>
              ) : (
                orderLines.map((line, i) => {
                  const cells = simpleInvoiceLineRowCells(items, line, i);
                  return (
                    <tr key={`${line.itemId}-${i}`} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      {cells.map((cell, ci) => (
                        <td key={ci} className="h-9 py-1 px-2 border-x border-[#D6EAF3] text-sm">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FormSectionCard>

      <FormSectionCard title="الحسابات" subtitle="بنود القيد عند الترحيل" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
        <div className="overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white [&_input]:h-9 [&_select]:h-9">
          <table className="min-w-full text-center border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="py-2 px-2 text-xs font-bold">م</th>
                <th className="py-2 px-2 text-xs font-bold">الحساب</th>
                <th className="py-2 px-2 text-xs font-bold">الخصم</th>
                <th className="py-2 px-2 text-xs font-bold">الإضافة</th>
                <th className="py-2 px-2 text-xs font-bold">الشرح</th>
                <th className="py-2 px-2 text-xs font-bold">مركز التكلفة</th>
                <th className="py-2 px-2 text-xs font-bold">العملة</th>
                <th className="py-2 px-2 text-xs font-bold">سعر الصرف</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="py-6">
                  <EmptyState title="لا توجد بنود إضافية — تُملأ من القيد عند الترحيل." />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </FormSectionCard>

      <InvoiceFinancialSummary summary={financialSummary} taxLabel="قيمة ضريبة المشتريات" />

      {/* Stamps Section */}
      <div className="mt-6 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-[#0E78AA] to-[#0A5F8A] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-[#0A3D5E]">الدمغات</h3>
        </div>
                    <div className="overflow-x-auto rounded-lg border border-[#D6EAF3] bg-white">
                      <table className="min-w-full text-center border-separate border-spacing-0">
                        <thead>
                          <tr>
                            <th className="py-3 px-2 font-bold">دمغة</th>
                            <th className="py-3 px-2 font-bold">عامة 1</th>
                            <th className="py-3 px-2 font-bold">عامة 2</th>
                            <th className="py-3 px-2 font-bold">عامة 3</th>
                            <th className="py-3 px-2 font-bold">عامة 4</th>
                            <th className="py-3 px-2 font-bold">عامة 5</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#F6FBFD]">
                            <td className="py-3 px-2 border-x border-[#D6EAF3] text-gray-700">دمغة</td>
                            <td className="py-3 px-2 border-x border-[#D6EAF3] text-gray-700">عامة 1</td>
                            <td className="py-3 px-2 border-x border-[#D6EAF3] text-gray-700">عامة 2</td>
                            <td className="py-3 px-2 border-x border-[#D6EAF3] text-gray-700">عامة 3</td>
                            <td className="py-3 px-2 border-x border-[#D6EAF3] text-gray-700">عامة 4</td>
                            <td className="py-3 px-2 border-x border-[#D6EAF3] text-gray-700">عامة 5</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
        
        {/* Terms Button */}
        <div className="mt-6 flex justify-center">
          <button 
            onClick={() => setShowTermsModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] text-white rounded-lg hover:from-[#0A5F8A] hover:to-[#084A6B] transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            الشروط
          </button>
        </div>
      </div>


      {/* Print Options Row */}
      <div className="mt-8 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
              <input 
                type="checkbox" 
                checked={printEnglishInvoice}
                onChange={(e) => setPrintEnglishInvoice(e.target.checked)}
                className="w-5 h-5 text-[#0E78AA] border-2 border-[#0E78AA] rounded focus:ring-2 focus:ring-[#0E78AA]"
              />
              <label className="text-sm text-[#0A3D5E] font-medium">طباعة فاتورة إنجليزي</label>
            </div>
            
            <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
              <input 
                type="checkbox" 
                checked={dontPrintEmptyLines}
                onChange={(e) => setDontPrintEmptyLines(e.target.checked)}
                className="w-5 h-5 text-[#0E78AA] border-2 border-[#0E78AA] rounded focus:ring-2 focus:ring-[#0E78AA]"
              />
              <label className="text-sm text-[#0A3D5E] font-medium">عدم طباعة أسطر فارغة</label>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-6 py-3 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] text-white rounded-xl hover:from-[#0A5F8A] hover:to-[#084A6B] transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              طباعة تواريخ الصلاحية
            </button>
            
            <button 
              onClick={() => setShowPrint(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] text-white rounded-xl hover:from-[#0A5F8A] hover:to-[#084A6B] transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              طباعة الباركود
            </button>
          </div>
        </div>
      </div>

      <FormStickyFooter
        onCancel={() => {
          setError('');
          setSuccess('');
          setOrderLines([]);
          reset(emptyPurchaseOrderHeader(new Date().toISOString().split('T')[0]));
        }}
        onSave={() =>
          void handleSubmit((header) => {
            setError('');
            setSuccess('');
            const parsed = inventoryPurchaseOrderFormSchema.safeParse({
              ...header,
              lines: orderLines,
            });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? 'خطأ في البيانات');
              return;
            }
            const d = parsed.data;
            purchaseOrderMutation.mutate({
              orderNumber: d.orderNumber,
              description: d.description,
              date: d.date || new Date().toISOString(),
              hijriDate: d.hijriDate,
              supplierId: d.supplierId,
              warehouseId: d.warehouseId,
              costCenterId: d.costCenterId || undefined,
              currencyId: d.currencyId || undefined,
              lines: d.lines.map((line) => ({
                itemId: line.itemId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount || 0,
                tax: line.tax || 0,
              })),
            });
          }, onFieldErrors(setError))()
        }
        saveLoading={loading}
        extraActions={
          <>
            <CrudButtons onPrevious={() => setShowList(true)} />
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E6EAF3] text-[#0A3D5E] shadow-sm hover:bg-[#F6FBFD] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span>معاينة</span>
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E6EAF3] text-[#0A3D5E] shadow-sm hover:bg-[#F6FBFD] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <span>تصميم</span>
            </button>
          </>
        }
      />

      {showPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[760px] max-w-[92vw] rounded-2xl shadow-2xl border border-[#D6EAF3] bg-white/95 overflow-hidden" style={{ direction: 'rtl' }}>
            <div className="relative px-6 py-4 bg-gradient-to-l from-[#0E78AA] to-[#1E88E5]">
              <h3 className="text-center text-white font-bold">طباعة الباركود</h3>
              <button onClick={() => setShowPrint(false)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white">✕</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 items-center">
                <label className="text-[#0A3D5E] text-sm">الطابعة</label>
                <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                  <option>Microsoft Print Pdf</option>
                </select>

                <label className="text-[#0A3D5E] text-sm">العدد</label>
                <input type="number" min="0" defaultValue="0" className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" />
              </div>

              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-[#0E78AA] border border-[#0E78AA] rounded focus:ring-2 focus:ring-[#0E78AA]/20" defaultChecked />
                    <span className="text-sm text-[#0A3D5E]">تصميم صغير</span>
                  </label>
                  <button className="px-3 py-1.5 text-sm border border-[#D6EAF3] rounded-lg hover:bg-[#F6FBFD] text-[#0A3D5E]">تصميم</button>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setShowPrint(false)} className="px-6 py-2 rounded-lg text-white bg-[#1F74D0] hover:brightness-110 transition">تراجع</button>
                  <button className="px-6 py-2 rounded-lg text-white bg-gradient-to-l from-[#31B36B] to-[#22A060] hover:brightness-110 transition">حفظ</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[700px] max-w-[95vw] rounded-2xl shadow-2xl border border-[#D6EAF3] bg-white overflow-hidden" style={{ direction: 'rtl' }}>
            {/* Header */}
            <div className="relative px-8 py-6 bg-gradient-to-l from-[#0E78AA] to-[#1E88E5]">
              <h3 className="text-center text-white font-bold text-2xl">الشروط</h3>
              <button onClick={() => setShowTermsModal(false)} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-xl">✕</button>
            </div>
            
            {/* Content */}
            <div className="p-8 space-y-8">
              {/* Payment Method Field */}
              <div className="flex items-center justify-between">
                <label className="text-[#0A3D5E] font-semibold text-base">طريقة الدفع</label>
                <div className="flex items-center gap-3">
                  <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                    <option>Microsoft Print Pdf</option>
                    <option>طريقة دفع أخرى</option>
                  </select>
                </div>
              </div>

              {/* Conditions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[#0A3D5E] font-semibold text-base">الشروط</label>
                  <button 
                    onClick={addCondition}
                    className="w-10 h-10 bg-[#0E78AA] text-white rounded-lg hover:bg-[#0A5F8A] transition-colors flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                
                {/* Dynamic Conditions List */}
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="text"
                        value={condition}
                        onChange={(e) => updateCondition(index, e.target.value)}
                        className="flex-1 p-3 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 text-base focus:ring-2 focus:ring-[#0E78AA]/20 focus:border-[#0E78AA]"
                        placeholder={`الشرط ${index + 1}`}
                      />
                      {conditions.length > 1 && (
                        <button
                          onClick={() => {
                            const updatedConditions = conditions.filter((_, i) => i !== index);
                            setConditions(updatedConditions);
                          }}
                          className="w-10 h-10 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-8 py-6 flex justify-between">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-8 py-3 bg-[#1F74D0] text-white rounded-lg hover:brightness-110 transition font-medium text-base">
                تراجع
              </button>
              <button
                onClick={() => {
                  // Handle save logic here
                  setShowTermsModal(false);
                }}
                className="px-8 py-3 bg-gradient-to-l from-[#31B36B] to-[#22A060] text-white rounded-lg hover:brightness-110 transition font-medium text-base">
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
