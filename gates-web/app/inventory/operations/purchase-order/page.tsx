'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryPurchaseOrderFormSchema,
  inventoryPurchaseOrderHeaderFormSchema,
  type InventoryPurchaseOrderHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { unpostedDocumentStatusLabel } from '@/lib/documents/document-status-labels';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { postStoreDocumentAfterSave } from '@/lib/inventory/post-store-document-after-save';

import { InvoiceFinancialSummary } from '@/components/inventory/InvoiceFinancialSummary';
import { computeInvoiceFinancialSummary } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { SupplierSelect } from '@/components/form/PartySelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { toFiniteNumber } from '@/components/dashboard/period';
import {
  isAtOrderLimit,
  reorderPurchaseQuantity,
  type ReorderCandidate,
} from '@/lib/inventory/reorder-items';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import { PURCHASE_ORDER_SOURCE_TYPES } from '@/lib/invoices/sourceDocument';
import { stockHeaderFieldsFromSource } from '@/lib/inventory/apply-source-to-stock-document';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface PurchaseOrderLine {
  itemId: string;
  itemLabel?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

function emptyOrderLine(): PurchaseOrderLine {
  return { itemId: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0 };
}

function orderLineNet(line: PurchaseOrderLine): number {
  const gross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
  const afterDiscount = gross * (1 - (Number(line.discount) || 0) / 100);
  return afterDiscount * (1 + (Number(line.tax) || 0) / 100);
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
  const warehouseId = watch('warehouseId');

  const [showCanceled, setShowCanceled] = useState(false);
  const [orderLines, setOrderLines] = useState<PurchaseOrderLine[]>([emptyOrderLine()]);
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const [showList, setShowList] = useState(false);
  const router = useRouter();
  const ownPathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => searchParams.get('orderId')?.trim() || null
  );
  const fromOrderLimit = searchParams.get('from') === 'order-limit';
  const reorderApplied = useRef(false);
  const postAfterSaveRef = useRef(false);

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

  const { data: reorderItemsResponse } = useApiQuery<ReorderCandidate[]>(
    ['purchase-order-reorder-items'],
    '/inventory/items',
    { limit: 200, isActive: true },
    { enabled: fromOrderLimit && !selectedOrderId, staleTime: 15_000 }
  );

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
      discountPercentage?: number | string;
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
        discount: Number(line.discountPercentage ?? line.discountValue ?? 0),
        tax: Number(line.taxPercentage ?? 0),
      }))
    );
  }, [selectedOrderResponse, selectedOrderId, reset, todayStr]);

  useEffect(() => {
    if (!fromOrderLimit || selectedOrderId || reorderApplied.current) return;
    if (!reorderItemsResponse) return;
    const rows = (reorderItemsResponse.data ?? []).filter(isAtOrderLimit);
    reorderApplied.current = true;
    setOrderLines(
      rows.length
        ? rows.map((item) => ({
            itemId: item.id,
            itemLabel: item.arabicName?.trim() || undefined,
            quantity: reorderPurchaseQuantity(item),
            unitPrice: toFiniteNumber(item.lastPurchasePrice),
            discount: 0,
            tax: 0,
          }))
        : [emptyOrderLine()]
    );
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  }, [fromOrderLimit, ownPathname, reorderItemsResponse, router, searchParams, selectedOrderId]);

  // Purchase order mutation
  const stayOnOrder = (id: string) => {
    setSelectedOrderId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('orderId', id);
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
    invalidateQuery(['purchase-order', id]);
  };

  const clearOrderForNext = () => {
    setSelectedOrderId(null);
    setOrderLines([emptyOrderLine()]);
    setSourceBarKey((k) => k + 1);
    reset(emptyPurchaseOrderHeader(new Date().toISOString().split('T')[0]));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('orderId');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  };

  const purchaseOrderMutation = useApiMutation<
    { id?: string; orderNumber?: string; serial?: string; serialNumber?: string },
    Record<string, unknown>
  >('/inventory/purchase-orders', 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      invalidateStockViews(invalidateQuery);
      const id = res.data?.id;
      const number = res.data?.orderNumber || res.data?.serialNumber || res.data?.serial;
      const shouldPost = postAfterSaveRef.current;
      postAfterSaveRef.current = false;
      const finish = (posted: boolean) => {
        finishDocumentSave({
          label: 'أمر شراء',
          number,
          posted,
          savedId: id,
          onOpen: stayOnOrder,
          onSavedOpen: (saved) => invalidateQuery(['purchase-order', saved]),
          reset: clearOrderForNext,
        });
      };
      if (shouldPost && id) {
        void postStoreDocumentAfterSave({
          postPath: `/inventory/purchase-orders/${id}/post`,
          onPosted: () => {
            setValue('isPosted', true);
            invalidateQuery(['purchase-orders']);
            finish(true);
          },
          onPostFailed: (message) => {
            setError(message);
            stayOnOrder(id);
          },
        });
        return;
      }
      finish(false);
    },
    onError: (error: ApiError) => {
      postAfterSaveRef.current = false;
      setError(error.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const purchaseOrderUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedOrderId ? `/inventory/purchase-orders/${selectedOrderId}` : '/inventory/purchase-orders',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        const id = selectedOrderId;
        const number = watch('orderNumber');
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finish = (posted: boolean) => {
          finishDocumentSave({
            label: 'أمر شراء',
            number,
            posted,
            savedId: id,
            onOpen: stayOnOrder,
            onSavedOpen: (saved) => invalidateQuery(['purchase-order', saved]),
            reset: clearOrderForNext,
          });
        };
        if (shouldPost && id) {
          void postStoreDocumentAfterSave({
            postPath: `/inventory/purchase-orders/${id}/post`,
            onPosted: () => {
              setValue('isPosted', true);
              invalidateQuery(['purchase-orders']);
              finish(true);
            },
            onPostFailed: (message) => {
              setError(message);
              if (id) invalidateQuery(['purchase-order', id]);
            },
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

  const approveMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedOrderId ? `/inventory/purchase-orders/${selectedOrderId}/approve` : '/inventory/purchase-orders',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم اعتماد أمر الشراء');
        if (selectedOrderId) invalidateQuery(['purchase-order', selectedOrderId]);
      },
      onError: (error: ApiError) => setError(error.message || 'تعذر الاعتماد'),
    }
  );

  const loading = purchaseOrderMutation.isPending || purchaseOrderUpdateMutation.isPending || approveMutation.isPending;

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
  const advancedFilledCount = [watch('hijriDate'), watch('costCenterId')].filter(Boolean).length;

  const handleNew = () => {
    setError('');
    setSuccess('');
    clearOrderForNext();
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, getValues('description'));
    if (header.supplierId) setValue('supplierId', header.supplierId);
    if (header.warehouseId) setValue('warehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    setOrderLines(
      payload.lines.length
        ? payload.lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity || 1,
            unitPrice: line.unitPrice || 0,
            discount: line.discount || 0,
            tax: line.taxRate || 0,
          }))
        : [emptyOrderLine()]
    );
    toast.success(`تم تحميل الأمر من ${payload.sourceNumber}`);
  };

  const submitOrderSave = (header: InventoryPurchaseOrderHeaderFormInput) => {
    setError('');
    setSuccess('');
    const parsed = inventoryPurchaseOrderFormSchema.safeParse({
      ...header,
      lines: orderLines.filter((line) => line.itemId),
    });
    if (!parsed.success) {
      postAfterSaveRef.current = false;
      setError(parsed.error.issues[0]?.message ?? 'خطأ في البيانات');
      return;
    }
    const d = parsed.data;
    (selectedOrderId ? purchaseOrderUpdateMutation : purchaseOrderMutation).mutate({
      orderNumber: d.orderNumber,
      description: d.description,
      date: d.date || new Date().toISOString(),
      hijriDate: d.hijriDate,
      supplierId: d.supplierId,
      warehouseId: d.warehouseId,
      costCenterId: d.costCenterId,
      currencyId: d.currencyId,
      isPosted: d.isPosted,
      isApproved: d.isApproved,
      lines: d.lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercentage: line.discount || 0,
        taxPercentage: line.tax || 0,
      })),
    });
  };

  const requestPostAfterSave = () => {
    if (isPosted) return;
    postAfterSaveRef.current = true;
    void handleSubmit(submitOrderSave, onFieldErrors(setError))();
  };

  const postExistingOrder = () => {
    if (!selectedOrderId) {
      requestPostAfterSave();
      return;
    }
    void apiClient
      .post(`/inventory/purchase-orders/${selectedOrderId}/post`)
      .then(() => {
        setValue('isPosted', true);
        setSuccess('تم ترحيل أمر الشراء');
        invalidateQuery(['purchase-orders']);
        invalidateQuery(['purchase-order', selectedOrderId]);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر الترحيل');
      });
  };

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'أمر الشراء' },
        ]}
        title="أمر الشراء"
        docNumber={watch('orderNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : unpostedDocumentStatusLabel(Boolean(selectedOrderId))}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSubmit(submitOrderSave, onFieldErrors(setError))()}
        savePending={loading}
        canSave={!isPosted && !loading}
        hideStandalonePost
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        currentId={selectedOrderId}
        favoriteHref="/inventory/operations/purchase-order"
        standardActions={{
          hasDocument: Boolean(selectedOrderId),
          isPosted: Boolean(isPosted),
          onPost: () => postExistingOrder(),
          onUnpost: () => {
            if (!selectedOrderId) {
              setError('احفظ أمر الشراء أولاً');
              return;
            }
            void apiClient
              .post(`/inventory/purchase-orders/${selectedOrderId}/unpost`)
              .then(() => {
                setValue('isPosted', false);
                setSuccess('تم إلغاء ترحيل أمر الشراء');
                invalidateQuery(['purchase-orders']);
                invalidateQuery(['purchase-order', selectedOrderId]);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'تعذر إلغاء الترحيل');
              });
          },
          onNew: handleNew,
          newLabel: 'جديد',
          extraItems: [
            {
              id: 'approve',
              label: 'اعتماد',
              disabled: !selectedOrderId || Boolean(watch('isApproved')) || approveMutation.isPending,
              onClick: () => approveMutation.mutate({}),
            },
          ],
        }}
        extraActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={orderLines.some((l) => Boolean(l.itemId))}
            disabled={Boolean(isPosted)}
            allowedTypes={PURCHASE_ORDER_SOURCE_TYPES}
            onHydrate={handleSourceHydrate}
          />
        }
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أوامر الشراء السابقة">
        <label className="mb-3 flex items-center gap-2 text-sm text-[#0A3D5E]">
          <input
            type="checkbox"
            checked={showCanceled}
            onChange={(e) => setShowCanceled(e.target.checked)}
          />
          عرض الملغي
        </label>
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
            stayOnOrder(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <FormSectionCard
        title="بيانات أمر الشراء"
        subtitle="المورد والتاريخ والعملة والمخزن"
      >
        <CompactFormField label="رقم أمر الشراء" placeholder="يُولَّد عند الحفظ" {...register('orderNumber')} />
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
        </div>
      </AdvancedFieldsSection>

      <FormSectionCard title="أصناف أمر الشراء" subtitle="الصنف والكمية والسعر" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[#0E78AA] px-3 py-1.5 text-sm font-bold text-white"
            onClick={() => setOrderLines((prev) => [...prev, emptyOrderLine()])}
            disabled={Boolean(isPosted)}
          >
            إضافة صنف
          </button>
        </div>
        <div className={`${denseTableWrapClass} [&_input]:h-8 [&_select]:h-8`}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                <th className={denseThClass}>م</th>
                <th className={denseThClass}>الصنف</th>
                <th className={denseThClass}>المتاح</th>
                <th className={denseThClass}>الكمية</th>
                <th className={denseThClass}>السعر</th>
                <th className={denseThClass}>خصم %</th>
                <th className={denseThClass}>ضريبة %</th>
                <th className={denseThClass}>الإجمالي</th>
                <th className={denseThClass}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((line, i) => {
                const patch = (partial: Partial<PurchaseOrderLine>) =>
                  setOrderLines((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...partial } : row)));
                const locked = Boolean(isPosted);
                return (
                  <tr key={`${line.itemId}-${i}`} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="h-9 px-2 py-1 text-sm">{i + 1}</td>
                    <td className="h-9 min-w-[180px] px-2 py-1 text-sm">
                      <ItemSelect
                        value={line.itemId}
                        fallbackLabel={line.itemLabel}
                        disabled={locked}
                        onChange={(itemId) => patch({ itemId })}
                      />
                    </td>
                    <td className="h-9 px-2 py-1 text-center text-sm">
                      <InvoiceLineStockBalanceCell itemId={line.itemId} warehouseId={warehouseId} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} step="any" className="w-20" disabled={locked} value={line.quantity} onChange={(e) => patch({ quantity: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} step="any" className="w-24" disabled={locked} value={line.unitPrice} onChange={(e) => patch({ unitPrice: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} max={100} step="any" className="w-16" disabled={locked} value={line.discount ?? 0} onChange={(e) => patch({ discount: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} step="any" className="w-16" disabled={locked} value={line.tax ?? 0} onChange={(e) => patch({ tax: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm font-mono">{orderLineNet(line).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <button
                        type="button"
                        className="text-red-600 disabled:opacity-40"
                        disabled={locked}
                        onClick={() =>
                          setOrderLines((prev) => {
                            const next = prev.filter((_, idx) => idx !== i);
                            return next.length > 0 ? next : [emptyOrderLine()];
                          })
                        }
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormSectionCard>

      <InvoiceFinancialSummary summary={financialSummary} taxLabel="قيمة ضريبة المشتريات" />

    </ErpDocumentLayout>
  );
}
