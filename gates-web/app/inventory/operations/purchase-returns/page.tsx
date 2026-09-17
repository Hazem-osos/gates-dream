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
import { toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
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

const ReturnInvoiceLinesGrid = dynamic(
  () =>
    import('@/components/inventory/returns/ReturnInvoiceLinesGrid').then((m) => ({
      default: m.ReturnInvoiceLinesGrid,
    })),
  { ssr: false, loading: () => <LineGridSkeleton label="جاري تحميل بنود مرتجع المشتريات…" /> }
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

export default function PurchaseReturnsPage() {
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
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [sourcePurchaseInvoiceId, setSourcePurchaseInvoiceId] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLineForm[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [debitNoteNumber, setDebitNoteNumber] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('credit');

  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'PURCHASE_RETURN'],
    '/transaction-settings/PURCHASE_RETURN'
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

  const { data: purchaseInvoicesResponse } = useApiQuery<SourceInvoiceOption[]>(
    ['invoices', 'purchase-picklist'],
    '/invoices',
    { invoiceKind: 'PURCHASE', isPosted: true, limit: 200 }
  );
  const purchaseInvoices = purchaseInvoicesResponse?.data || [];

  const { data: returnableRes } = useApiQuery<{
    originalInvoiceId: string;
    originalInvoiceNumber: string | null;
    supplierId: string | null;
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
    ['invoice', 'returnable-lines', sourcePurchaseInvoiceId],
    `/invoices/${sourcePurchaseInvoiceId}/returnable-lines`,
    undefined,
    { enabled: Boolean(sourcePurchaseInvoiceId) }
  );

  const { data: sourcePurchaseResponse } = useApiQuery<Record<string, unknown>>(
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
    setSupplierId(String(selectedInvoice.supplierId ?? ''));
    setWarehouseId(String(selectedInvoice.warehouseId ?? ''));
    setSourcePurchaseInvoiceId(String(selectedInvoice.originalInvoiceId ?? ''));
    setCurrencyId(String(selectedInvoice.currencyId ?? currencyId));
    setIsPosted(Boolean(selectedInvoice.isPosted));
    const lines = (selectedInvoice.lines as Array<Record<string, unknown>> | undefined)?.map(
      (line) => ({
        itemId: String(line.itemId ?? ''),
        unitId: String(line.unitId ?? ''),
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        discount: Number(line.discount ?? 0) || 0,
        taxRate: Number(line.tax ?? line.taxRate ?? 0) || 0,
        originalInvoiceLineId: line.originalInvoiceLineId
          ? String(line.originalInvoiceLineId)
          : undefined,
      })
    );
    setReturnLines(lines ?? []);
  }, [selectedInvoice, currencyId, date]);

  useEffect(() => {
    const inv = sourcePurchaseResponse?.data;
    if (!inv || !fromInvoiceParam || prefillApplied.current || selectedReturnId) return;
    prefillApplied.current = true;
    setSelectedReturnId(null);
    setIsPosted(false);
    setSourcePurchaseInvoiceId(fromInvoiceParam);
    setSupplierId(String(inv.supplierId ?? ''));
    setWarehouseId(String(inv.warehouseId ?? ''));
    setCurrencyId(String(inv.currencyId ?? currencyId));
    setInvoiceNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    const refNo = String(inv.invoiceNumber ?? fromInvoiceParam);
    setDescription(`مردود عن فاتورة مشتريات ${refNo}`);
    setSuccess('تم تحميل بنود الفاتورة الأصلية — عدّل الكميات المراد إرجاعها');
  }, [sourcePurchaseResponse, fromInvoiceParam, selectedReturnId, currencyId]);

  useEffect(() => {
    const snap = returnableRes?.data;
    if (!snap || !sourcePurchaseInvoiceId || selectedReturnId) return;
    setSupplierId(snap.supplierId || '');
    if (snap.warehouseId) setWarehouseId(snap.warehouseId);
    const refNo = snap.originalInvoiceNumber || sourcePurchaseInvoiceId;
    setDescription((prev) => prev || `مردود عن فاتورة مشتريات ${refNo}`);
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
  }, [returnableRes?.data, sourcePurchaseInvoiceId, selectedReturnId]);

  const resetForm = useCallback(() => {
    resetKeepPosted();
    setSelectedReturnId(null);
    setIsPosted(false);
    setInvoiceNumber('');
    setDescription('');
    setSupplierId('');
    setWarehouseId(txSettings?.defaultWarehouseId ?? '');
    setSourcePurchaseInvoiceId('');
    setReturnLines([]);
    setDate(new Date().toISOString().split('T')[0]);
  }, [resetKeepPosted, txSettings?.defaultWarehouseId]);

  const sourceRefLabel = () => {
    const ref = purchaseInvoices.find((i) => i.id === sourcePurchaseInvoiceId);
    return ref?.invoiceNumber || returnableRes?.data?.originalInvoiceNumber || sourcePurchaseInvoiceId;
  };

  const buildPayload = () => {
    if (!warehouseId) throw new Error('يرجى اختيار المخزن');
    if (!supplierId) throw new Error('يرجى اختيار المورد');
    if (returnLines.length === 0) throw new Error('يرجى إضافة سطر واحد على الأقل');
    if (!allowStandalone && !sourcePurchaseInvoiceId) {
      throw new Error(
        'غير مسموح بإنشاء مردود مشتريات حر دون الارتباط بفاتورة مشتريات أصلية مسبقة طبقاً لسياسة الشركة'
      );
    }
    const over = returnLines.find(
      (line) => line.returnableQty != null && line.quantity > line.returnableQty + 1e-6
    );
    if (over) {
      throw new Error(
        `لا يمكن إرجاع كمية [${over.quantity}] من الصنف. أقصى كمية متبقية قابلة للإرجاع هي [${over.returnableQty}]`
      );
    }
    let desc = description.trim();
    const refLabel = sourceRefLabel();
    if (sourcePurchaseInvoiceId) {
      desc = desc ? `${desc} — مرجع: ${refLabel}` : `مرجع: ${refLabel}`;
    }
    return mapSalesFormToM5CreateBody(
      {
        invoiceNumber,
        description: desc || undefined,
        date,
        hijriDate: hijriDate || undefined,
        supplierId,
        warehouseId,
        currencyId,
        paymentMethod: 'credit',
        originalInvoiceId: sourcePurchaseInvoiceId || undefined,
        originalInvoiceNumber: sourcePurchaseInvoiceId ? String(refLabel || '') : undefined,
        lines: returnLines,
      },
      { invoiceKind: 'PURCHASE_RETURN', currencies, items }
    );
  };

  const createMutation = useApiMutation<{ id?: string }, Record<string, unknown>>('/invoices', 'POST', {
    showSuccessToast: false,
    onSuccess: () => {
      invalidateQuery(['invoices']);
      resetForm();
      setSuccess('تم حفظ مردود المشتريات');
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
              supplierId,
              warehouseId,
              currencyId,
              paymentMethod: 'credit',
              originalInvoiceId: sourcePurchaseInvoiceId || undefined,
              originalInvoiceNumber: sourcePurchaseInvoiceId ? String(sourceRefLabel() || '') : undefined,
              lines: returnLines,
            },
            {
              invoiceKind: 'PURCHASE_RETURN',
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
        setSuccess('تم حفظ وترحيل مردود المشتريات');
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
          { label: 'مردودات المشتريات' },
        ]}
        title="مردود مشتريات"
        docNumber={invoiceNumber}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحل ومثبت (Posted)' : 'مسودة (Draft)'}
        onSaveDraft={handleSave}
        saveLabel="حفظ وترحيل مردود المشتريات"
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
          { id: 'print', label: 'طباعة', onClick: () => void printPageContent('مرتجع مشتريات') },
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
        documentType="PURCHASE_RETURN"
      />

      <DocumentBrowseDrawer
        open={showList}
        onClose={() => setShowList(false)}
        title="مردودات المشتريات السابقة"
      >
        <InventoryInvoicesListSection
          compact
          title="مردودات المشتريات السابقة"
          invoiceKind="PURCHASE_RETURN"
          partyColumnHeader="المورد"
          getPartyName={(row) => row.supplier?.arabicName || '—'}
          selectedInvoiceId={selectedReturnId}
          onSelectInvoice={(id) => {
            setSelectedReturnId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <ReturnInvoiceFormHeader
        variant="purchase"
        partyId={supplierId}
        onPartyId={setSupplierId}
        warehouseId={warehouseId}
        onWarehouseId={setWarehouseId}
        date={date}
        onDate={setDate}
        invoiceNumber={invoiceNumber}
        onInvoiceNumber={setInvoiceNumber}
        sourceInvoiceId={sourcePurchaseInvoiceId}
        onSourceInvoiceId={(id) => {
          setSourcePurchaseInvoiceId(id);
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
          supplierId
            ? purchaseInvoices.filter((inv) => !inv.supplierId || inv.supplierId === supplierId)
            : purchaseInvoices
        }
        allowStandaloneReturns={allowStandalone}
        sourceRequired={!allowStandalone}
        currencyId={currencyId}
        onCurrencyId={setCurrencyId}
        currencies={currencies}
        description={description}
        onDescription={setDescription}
        returnReason={returnReason}
        onReturnReason={setReturnReason}
        debitNoteNumber={debitNoteNumber}
        onDebitNoteNumber={setDebitNoteNumber}
        settlementMethod={settlementMethod}
        onSettlementMethod={setSettlementMethod}
        onLoadSourceLines={() => {
          if (!sourcePurchaseInvoiceId) return;
          setSuccess('جاري تحميل بنود الفاتورة الأصلية...');
        }}
      />

      <div className="mt-2">
        <ReturnInvoiceLinesGrid
          lines={returnLines}
          onChange={setReturnLines}
          warehouseId={warehouseId}
          lockUnitPrice={Boolean(sourcePurchaseInvoiceId) && enforceOriginalPrice}
          allowAddLines={allowStandalone}
          headerDescription={description}
        />
      </div>

      <ReturnStickyFooter
        saveLabel="حفظ وترحيل مردود المشتريات"
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
