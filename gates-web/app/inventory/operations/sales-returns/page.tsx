'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ReturnStickyFooter } from '@/components/inventory/returns/ReturnStickyFooter';
import { InventoryInvoicesListSection } from '@/components/inventory/InventoryInvoicesListSection';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import {
  postInvoiceAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
import { toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import { computeInvoiceFinancialSummary } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ERP_INVOICE_DOCUMENT_LAYOUT_CLASS } from '@/components/erp/erpUiTokens';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ReturnInvoiceFormHeader, type SourceInvoiceOption } from '@/components/inventory/returns/ReturnInvoiceFormHeader';
import type { ReturnLineForm } from '@/components/inventory/returns/ReturnInvoiceLinesGrid';
import type { TransactionSettings } from '@/lib/transaction-settings/types';
import { TransactionSettingsDrawer } from '@/components/settings/transaction-settings/TransactionSettingsDrawer';
import { PurchaseInvoiceBottomSplit } from '@/components/inventory/purchase-invoice/PurchaseInvoiceBottomSplit';
import dynamic from 'next/dynamic';
import { LineGridSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { printPageContent } from '@/lib/print/printHtml';
import { invoiceReturnBlockReason } from '@/lib/invoices/return-policy';

const ReturnInvoiceLinesGrid = dynamic(
  () =>
    import('@/components/inventory/returns/ReturnInvoiceLinesGrid').then((m) => ({
      default: m.ReturnInvoiceLinesGrid,
    })),
  { ssr: false, loading: () => <LineGridSkeleton label="جاري تحميل بنود مرتجع المبيعات…" /> }
);

interface Currency {
  id: string;
  code: string;
  arabicName: string;
}
interface Item {
  id: string;
  units?: { unit?: { id: string } }[];
}

export default function SalesReturnsPage() {
  const searchParams = useOwnTabSearchParams();
  const fromInvoiceParam = searchParams.get('fromInvoice');
  const invoiceIdParam = searchParams.get('invoiceId');
  const prefillApplied = useRef(false);

  const invalidateQuery = useInvalidateQuery();
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(
    () => invoiceIdParam?.trim() || null
  );
  const [isPosted, setIsPosted] = useState(false);
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hijriDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [sourceSaleInvoiceId, setSourceSaleInvoiceId] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLineForm[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restock, setRestock] = useState(true);
  const [returnReason, setReturnReason] = useState('');

  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'SALES_RETURN'],
    '/transaction-settings/SALES_RETURN'
  );
  const txSettings = txSettingsRes?.data;
  const allowStandalone = txSettings?.allowStandaloneReturns !== false;
  const enforceOriginalPrice = txSettings?.enforceOriginalPrice !== false;

  const { data: invoiceResponse } = useApiQuery<Record<string, unknown>>(
    ['invoice', selectedReturnId],
    `/invoices/${selectedReturnId}`,
    undefined,
    { enabled: !!selectedReturnId }
  );
  const selectedInvoice = invoiceResponse?.data;

  const { data: itemsResponse } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 200, isActive: true }
  );
  const items = itemsResponse?.data || [];

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  const { data: salesInvoicesResponse } = useApiQuery<SourceInvoiceOption[]>(
    ['invoices', 'sale-picklist'],
    '/invoices',
    { invoiceKind: 'SALE', isPosted: true, limit: 200 }
  );
  const salesInvoices = salesInvoicesResponse?.data || [];

  const { data: returnableRes, isError: returnableFailed, error: returnableError } = useApiQuery<{
    originalInvoiceId: string;
    originalInvoiceNumber: string | null;
    customerId: string | null;
    warehouseId: string | null;
    lines: Array<{
      originalInvoiceLineId: string;
      itemId: string;
      itemName: string;
      unitId: string;
      soldQty: number;
      returnedQty: number;
      returnableQty: number;
      unitPrice: number;
      taxPercent: number;
      discountPercent: number;
      warehouseId: string | null;
    }>;
  }>(
    ['invoice', 'returnable-lines', sourceSaleInvoiceId],
    `/invoices/${sourceSaleInvoiceId}/returnable-lines`,
    undefined,
    { enabled: Boolean(sourceSaleInvoiceId) }
  );

  const { data: sourceSaleResponse } = useApiQuery<Record<string, unknown>>(
    ['invoice', 'return-source', fromInvoiceParam],
    `/invoices/${fromInvoiceParam}`,
    undefined,
    { enabled: !!fromInvoiceParam && !prefillApplied.current }
  );

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const id = invoiceIdParam?.trim();
    if (id && id !== selectedReturnId) setSelectedReturnId(id);
  }, [invoiceIdParam, selectedReturnId]);

  useEffect(() => {
    if (selectedReturnId || !txSettings?.defaultWarehouseId || warehouseId) return;
    setWarehouseId(txSettings.defaultWarehouseId);
  }, [selectedReturnId, txSettings?.defaultWarehouseId, warehouseId]);

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      setCurrencyId((currencies.find((c) => c.code === 'EGP') || currencies[0]).id);
    }
  }, [currencies, currencyId]);

  useEffect(() => {
    if (!selectedInvoice) return;
    setInvoiceNumber(String(selectedInvoice.invoiceNumber ?? ''));
    setDescription(String(selectedInvoice.description ?? ''));
    setDate(
      selectedInvoice.date
        ? new Date(String(selectedInvoice.date)).toISOString().split('T')[0]
        : date
    );
    setCustomerId(String(selectedInvoice.customerId ?? ''));
    setWarehouseId(String(selectedInvoice.warehouseId ?? ''));
    setSourceSaleInvoiceId(String(selectedInvoice.originalInvoiceId ?? ''));
    setCurrencyId(String(selectedInvoice.currencyId ?? currencyId));
    setIsPosted(Boolean(selectedInvoice.isPosted));
    const lines = (selectedInvoice.lines as Array<Record<string, unknown>> | undefined)?.map(
      (line) => ({
        itemId: String(line.itemId ?? ''),
        unitId: String(line.unitId ?? ''),
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.price ?? line.unitPrice) || 0,
        discount: Number(line.discount ?? 0) || 0,
        taxRate: Number(line.taxPercent ?? line.tax ?? line.taxRate ?? 0) || 0,
        originalInvoiceLineId: line.originalInvoiceLineId
          ? String(line.originalInvoiceLineId)
          : undefined,
      })
    );
    setReturnLines(lines ?? []);
  }, [selectedInvoice, currencyId, date]);

  useEffect(() => {
    const inv = sourceSaleResponse?.data;
    if (!inv || !fromInvoiceParam || prefillApplied.current || selectedReturnId) return;
    const block = invoiceReturnBlockReason({
      allowReturn: Boolean(inv.allowReturn),
      returnDays: inv.returnDays != null ? Number(inv.returnDays) : undefined,
      date: inv.date as string | Date | undefined,
      invoiceNumber: inv.invoiceNumber ? String(inv.invoiceNumber) : undefined,
    });
    if (block) {
      prefillApplied.current = true;
      setError(block);
      return;
    }
    prefillApplied.current = true;
    setSelectedReturnId(null);
    setIsPosted(false);
    setSourceSaleInvoiceId(fromInvoiceParam);
    setCustomerId(String(inv.customerId ?? ''));
    setWarehouseId(String(inv.warehouseId ?? ''));
    setCurrencyId(String(inv.currencyId ?? currencyId));
    setInvoiceNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    const refNo = String(inv.invoiceNumber ?? fromInvoiceParam);
    setDescription(`مرتجع عن فاتورة ${refNo}`);
    const lines = (inv.lines as Array<Record<string, unknown>> | undefined)?.map((line) => ({
      itemId: String(line.itemId ?? ''),
      unitId: String(line.unitId ?? ''),
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(line.price ?? line.unitPrice) || 0,
      discount: Number(line.discount ?? 0) || 0,
      taxRate: Number(line.taxPercent ?? line.tax ?? line.taxRate ?? 0) || 0,
      // H10 fix: `line.id` here is the ORIGINAL sold line — carry it through so
      // the server can enforce that this return never exceeds what was sold.
      originalInvoiceLineId: line.id ? String(line.id) : undefined,
    }));
    setReturnLines(lines ?? []);
    setSuccess('تم تحميل بنود الفاتورة الأصلية — عدّل الكميات المراد إرجاعها');
  }, [sourceSaleResponse, fromInvoiceParam, selectedReturnId, currencyId]);

  useEffect(() => {
    const snap = returnableRes?.data;
    if (!snap || !sourceSaleInvoiceId || selectedReturnId) return;
    setCustomerId(snap.customerId || '');
    if (snap.warehouseId) setWarehouseId(snap.warehouseId);
    const refNo = snap.originalInvoiceNumber || sourceSaleInvoiceId;
    setDescription((prev) => prev || `مرتجع عن فاتورة ${refNo}`);
    setReturnLines(
      snap.lines
        .filter((line) => line.returnableQty > 0)
        .map((line) => ({
          itemId: line.itemId,
          unitId: line.unitId,
          quantity: line.returnableQty,
          unitPrice: line.unitPrice,
          discount: line.discountPercent,
          taxRate: line.taxPercent,
          originalInvoiceLineId: line.originalInvoiceLineId,
          soldQty: line.soldQty,
          returnableQty: line.returnableQty,
        }))
    );
  }, [returnableRes?.data, sourceSaleInvoiceId, selectedReturnId]);

  useEffect(() => {
    if (!returnableFailed || !sourceSaleInvoiceId || selectedReturnId) return;
    setError(returnableError?.message || 'هذه الفاتورة غير قابلة لعمل مردود');
    setReturnLines([]);
  }, [returnableFailed, returnableError, sourceSaleInvoiceId, selectedReturnId]);

  const resetForm = useCallback(() => {
    resetKeepPosted();
    setSelectedReturnId(null);
    setIsPosted(false);
    setInvoiceNumber('');
    setDescription('');
    setCustomerId('');
    setWarehouseId('');
    setSourceSaleInvoiceId('');
    setReturnLines([]);
    setDate(new Date().toISOString().split('T')[0]);
  }, [resetKeepPosted]);

  const buildPayload = () => {
    if (!warehouseId) throw new Error('يرجى اختيار المخزن');
    if (!customerId) throw new Error('يرجى اختيار العميل');
    if (returnLines.length === 0) throw new Error('يرجى إضافة سطر واحد على الأقل');
    if (!allowStandalone && !sourceSaleInvoiceId) {
      throw new Error('غير مسموح بإنشاء مردود مبيعات حر دون الارتباط بفاتورة بيع أصلية مسبقة طبقاً لسياسة الشركة');
    }
    const over = returnLines.find(
      (line) => line.returnableQty != null && line.quantity > line.returnableQty + 1e-6
    );
    if (over) {
      throw new Error(
        `لا يمكن إرجاع كمية [${over.quantity}] أكبر من المتاح للإرجاع [${over.returnableQty}]`
      );
    }
    let desc = description.trim();
    const ref = salesInvoices.find((i) => i.id === sourceSaleInvoiceId);
    const refLabel = ref?.invoiceNumber || returnableRes?.data?.originalInvoiceNumber || sourceSaleInvoiceId;
    if (sourceSaleInvoiceId) {
      desc = desc ? `${desc} — مرجع: ${refLabel}` : `مرجع: ${refLabel}`;
    }
    return mapSalesFormToM5CreateBody(
      {
        invoiceNumber,
        description: desc || undefined,
        date,
        hijriDate: hijriDate || undefined,
        customerId,
        warehouseId,
        currencyId,
        paymentMethod: 'credit',
        originalInvoiceId: sourceSaleInvoiceId || undefined,
        originalInvoiceNumber: sourceSaleInvoiceId ? String(refLabel || '') : undefined,
        lines: returnLines,
      },
      { invoiceKind: 'SALE_RETURN', currencies, items }
    );
  };

  const createMutation = useApiMutation<{ id?: string }, Record<string, unknown>>('/invoices', 'POST', {
    showSuccessToast: false,
    onSuccess: () => {
      invalidateQuery(['invoices']);
      resetForm();
      setSuccess('تم حفظ مردود المبيعات');
    },
    onError: (error: ApiError) => setError(error.message || 'فشل الحفظ'),
  });

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReturnId ? `/invoices/${selectedReturnId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['invoices']);
        const id = selectedReturnId;
        if (consumeShouldRepost() && id) {
          void postInvoiceAfterSave(id)
            .then(() => {
              resetForm();
              setSuccess('تم حفظ التعديلات وترحيل المردود');
            })
            .catch((error: ApiError) => {
              resetForm();
              setError(error.message || 'تم الحفظ لكن تعذر ترحيل المردود');
            });
          return;
        }
        resetForm();
        setSuccess('تم تحديث المردود');
      },
      onError: (error: ApiError) => {
        if (isOptimisticLockApiError(error)) {
          toastVersionConflict(error.message, () => invalidateQuery(['invoice', selectedReturnId]));
          return;
        }
        setError(error.message || 'فشل التحديث');
      },
    }
  );

  const postMutation = useApiMutation<unknown, Record<string, never>>(
    selectedReturnId ? `/invoices/${selectedReturnId}/post` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setIsPosted(true);
        setSuccess('تم ترحيل المردود');
        invalidateQuery(['invoices']);
      },
      onError: (error: ApiError) => {
        setIsPosted(false);
        setError(error.message || 'فشل الترحيل');
      },
    }
  );

  const unpostMutation = useApiMutation<unknown, Record<string, never>>(
    selectedReturnId ? `/invoices/${selectedReturnId}/unpost` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setIsPosted(false);
        markUnpostedForEdit();
        setSuccess('تم فك ترحيل المردود');
        invalidateQuery(['invoices']);
      },
      onError: (error: ApiError) => setError(error.message || 'فشل فك الترحيل'),
    }
  );

  const financialBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    postMutation.isPending ||
    unpostMutation.isPending;

  const handleSave = async () => {
    if (financialBusy || isPosted) return;
    setError('');
    try {
      const body = buildPayload();
      let id = selectedReturnId;
      if (id) {
        await updateMutation.mutateAsync(
          mapSalesFormToM5UpdateBody(
            {
              invoiceNumber,
              description: body.description as string | undefined,
              date,
              customerId,
              warehouseId,
              currencyId,
              paymentMethod: 'credit',
              originalInvoiceId: sourceSaleInvoiceId || undefined,
              originalInvoiceNumber:
                salesInvoices.find((i) => i.id === sourceSaleInvoiceId)?.invoiceNumber ||
                returnableRes?.data?.originalInvoiceNumber ||
                undefined,
              lines: returnLines,
            },
            {
              invoiceKind: 'SALE_RETURN',
              currencies,
              items,
              expectedVersion:
                typeof selectedInvoice?.version === 'number' ? selectedInvoice.version : undefined,
            }
          )
        );
      } else {
        const res = await createMutation.mutateAsync(body);
        id = res.data?.id ?? null;
        if (id) setSelectedReturnId(id);
      }
      if (id) {
        await apiClient.post(`/invoices/${id}/post`, {});
        setIsPosted(true);
        setSuccess('تم حفظ وترحيل مردود المبيعات');
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', id]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تحقق من البيانات');
    }
  };

  const summary = useMemo(
    () => computeInvoiceFinancialSummary(returnLines, { applyTax: true }),
    [returnLines]
  );

  return (
    <ErpDocumentLayout className={ERP_INVOICE_DOCUMENT_LAYOUT_CLASS}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'مردودات المبيعات' },
        ]}
        title="مردود مبيعات"
        docNumber={invoiceNumber}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحل ومثبت (Posted)' : 'مسودة (Draft)'}
        onSaveDraft={handleSave}
        saveLabel="حفظ وترحيل مردود المبيعات"
        hideStandalonePost
        savePending={financialBusy}
        canSave={!isPosted && !financialBusy}
        onEdit={() => {
          if (!selectedReturnId) return;
          if (isPosted) {
            setError('فك الترحيل أولاً حتى يمكن التعديل');
            return;
          }
        }}
        editDisabled={!selectedReturnId || isPosted}
        moreMenuItems={[
          { id: 'new', label: 'مردود جديد', onClick: resetForm },
          { id: 'print', label: 'طباعة', onClick: () => void printPageContent('مرتجع مبيعات') },
          {
            id: 'post',
            label: 'ترحيل المردود',
            disabled: !selectedReturnId || isPosted || financialBusy,
            onClick: () => {
              if (!selectedReturnId) setError('احفظ أولاً');
              else postMutation.mutate({});
            },
          },
          {
            id: 'unpost',
            label: 'فك الترحيل',
            disabled: !selectedReturnId || !isPosted || financialBusy,
            onClick: () => {
              if (selectedReturnId) unpostMutation.mutate({});
            },
          },
          { id: 'settings', label: 'خيارات إضافية', onClick: () => setSettingsOpen(true) },
        ]}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
      />

      <TransactionSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        documentType="SALES_RETURN"
      />

      <DocumentBrowseDrawer
        open={showList}
        onClose={() => setShowList(false)}
        title="مردودات المبيعات السابقة"
      >
        <InventoryInvoicesListSection
          compact
          title="مردودات المبيعات السابقة"
          invoiceKind="SALE_RETURN"
          partyColumnHeader="العميل"
          getPartyName={(row) => row.customer?.arabicName || '—'}
          selectedInvoiceId={selectedReturnId}
          onSelectInvoice={(id) => {
            setSelectedReturnId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <div data-tour-id="sales-returns-header">
        <ReturnInvoiceFormHeader
          variant="sales"
          partyId={customerId}
          onPartyId={setCustomerId}
          warehouseId={warehouseId}
          onWarehouseId={setWarehouseId}
          date={date}
          onDate={setDate}
          invoiceNumber={invoiceNumber}
          onInvoiceNumber={setInvoiceNumber}
          sourceInvoiceId={sourceSaleInvoiceId}
          onSourceInvoiceId={(id) => {
            setSourceSaleInvoiceId(id);
            if (!id) {
              setReturnLines((prev) =>
                prev.map((l) => ({
                  ...l,
                  originalInvoiceLineId: undefined,
                  soldQty: undefined,
                  returnableQty: undefined,
                }))
              );
            }
          }}
          sourceInvoices={
            customerId
              ? salesInvoices.filter((inv) => !inv.customerId || inv.customerId === customerId)
              : salesInvoices
          }
          allowStandaloneReturns={allowStandalone}
          sourceRequired={!allowStandalone}
          currencyId={currencyId}
          onCurrencyId={setCurrencyId}
          currencies={currencies}
          description={description}
          onDescription={setDescription}
          restock={restock}
          onRestock={setRestock}
          returnReason={returnReason}
          onReturnReason={setReturnReason}
          onLoadSourceLines={() => {
            if (!sourceSaleInvoiceId) return;
            setSuccess('جاري تحميل بنود الفاتورة الأصلية...');
          }}
        />
      </div>

      <div className="mt-2" data-tour-id="sales-returns-lines">
        <ReturnInvoiceLinesGrid
          lines={returnLines}
          onChange={setReturnLines}
          warehouseId={warehouseId}
          lockUnitPrice={Boolean(sourceSaleInvoiceId) && enforceOriginalPrice}
          allowAddLines={allowStandalone}
          headerDescription={description}
        />
      </div>

      <ReturnStickyFooter
        saveLabel="حفظ وترحيل مردود المبيعات"
        savePending={financialBusy}
        canSave={!isPosted && !financialBusy}
        netTotal={summary.netAmount}
        journalEntryId={(selectedInvoice as { journalEntryId?: string | null })?.journalEntryId}
        onSave={handleSave}
        onCancel={resetForm}
      />

      <PurchaseInvoiceBottomSplit
        summary={summary}
        applyTax
        lines={returnLines.map((l) => ({ ...l, itemId: l.itemId, taxRate: l.taxRate }))}
        warehouseId={warehouseId}
        journalEntryId={(selectedInvoice as { journalEntryId?: string | null })?.journalEntryId}
        selectedInvoiceId={selectedReturnId}
        isPosted={isPosted}
      />
    </ErpDocumentLayout>
  );
}
