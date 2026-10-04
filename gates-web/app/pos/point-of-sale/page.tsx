'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Pause, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { localizeUnknownError } from '@/lib/api/localize-api-error-message';
import { PosTerminalPicker, usePosSession } from '@/lib/hooks/usePosSession';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';
import { formatMoneyAr } from '@/lib/formatMoney';
import { printThermalViaBrowser } from '@/lib/printer/rawbt-fallback';
import { renderReceiptToCanvas } from '@/lib/printer/receipt-canvas';
import { canvasToEscPos } from '@/lib/printer/escpos-encoder';
import { bluetoothThermalPrinter, isWebBluetoothAvailable } from '@/lib/printer/web-bluetooth';
import type { ThermalInvoiceData } from '@/lib/printer/types';
import { canQueueOfflineSale, nextOfflineState } from '@/lib/pos/offline-checkout';
import { enqueuePosSale, listPosOutbox, removePosOutbox, updatePosOutbox } from '@/lib/pos/offline-outbox';
import QRCode from 'qrcode';

type CatalogItem = {
  id: string;
  arabicName: string;
  barcode?: string | null;
  unitId: string | null;
  unitName: string;
  price: number;
  taxPercent: number;
  onHand: number | null;
  categoryId?: string | null;
  scannedQuantity?: number | null;
};

type CartLine = {
  key: string;
  itemId: string;
  unitId: string;
  name: string;
  quantity: number;
  notes?: string;
  discountPercent?: string;
  priceOverride?: string;
};

type Quote = {
  netAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  lines: Array<{ itemId: string; price: number; taxAmount: number; lineTotal: number; quantity: number; isGift?: boolean }>;
};

type HeldOrder = {
  id: string;
  orderNumber: string;
  notes?: string | null;
  netAmount?: number | string;
  customer?: { id?: string; arabicName?: string } | null;
  lines: Array<{ itemId: string; unitId: string; quantity: number | string; notes?: string | null; item?: { arabicName?: string } }>;
};

type PaymentLine = {
  key: string;
  method: string;
  settlementType: string;
  amount: string;
  tendered: string;
  reference: string;
  currencyCode?: string;
};

type ReceiptPayload = {
  title?: string;
  orderType?: string;
  companyName: string;
  branchName?: string;
  originalOrderNumber?: string | null;
  orderNumber: string;
  postedAt?: string;
  cashier?: string | null;
  customerName?: string | null;
  notes?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  net: number;
  lines: Array<{ name: string; quantity: number; price: number; total: number }>;
  payments: Array<{ method: string; label?: string; amount: number; tenderedAmount?: number | null; changeAmount?: number | null }>;
  tendered: number;
  change: number;
  qrPayload?: string | null;
  etaUuid?: string | null;
  etaReceiptNumber?: string | null;
  etaStatusLabel?: string | null;
  fiscal?: { cashier?: string; labelAr?: string; status?: string } | null;
};

type PosMethod = {
  code: string;
  displayName: string;
  settlementType: 'CASH' | 'BANK' | 'CREDIT' | 'GIFT_CARD' | 'STORE_CREDIT' | 'POINTS' | 'DEPOSIT';
  captureMode?: string;
};

function publishDisplay(payload: Record<string, unknown>) {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('gates-pos-display');
  channel.postMessage(payload);
  channel.close();
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

/** Send only finite decimals to POS quote/save (avoids validation errors while typing). */
function parseOptionalDecimal(
  raw: string | undefined,
  options?: { min?: number; max?: number }
): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw.trim().replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  const min = options?.min ?? 0;
  if (n < min) return undefined;
  if (options?.max != null && n > options.max) return undefined;
  return n;
}

function buildPosLinePayload(
  cart: CartLine[],
  options: { canDiscount: boolean; canOverride: boolean }
) {
  return cart.map((line, index) => ({
    itemId: line.itemId,
    unitId: line.unitId,
    quantity: line.quantity,
    lineOrder: index + 1,
    notes: line.notes,
    discountPercent:
      options.canDiscount && line.discountPercent
        ? parseOptionalDecimal(line.discountPercent, { min: 0, max: 100 })
        : undefined,
    price:
      options.canOverride && line.priceOverride
        ? parseOptionalDecimal(line.priceOverride, { min: 0 })
        : undefined,
  }));
}

export default function PointOfSalePage() {
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldOrder[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [openingCash, setOpeningCash] = useState('');
  const [headerDiscount, setHeaderDiscount] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [postedOrderId, setPostedOrderId] = useState<string | null>(null);
  const [receiptLink, setReceiptLink] = useState('');
  const [receiptQr, setReceiptQr] = useState('');
  const posPermissions = useResourcePermissions({ resource: 'pos', module: 'pos' });
  const invoicePermissions = useResourcePermissions({ resource: 'invoice' });
  const canDiscount = posPermissions.can('discount') || invoicePermissions.can('discount');
  const canOverride =
    posPermissions.can('override_tier_price') || invoicePermissions.can('override_tier_price');
  const canReprint = posPermissions.can('reprint');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ThermalInvoiceData | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [syncLabel, setSyncLabel] = useState('');
  const settingsQuery = useApiQuery<{ offlineEnabled: boolean }>(['pos-settings-offline'], '/pos/admin/settings');

  const {
    shiftId,
    terminal,
    hasTerminal,
    ensureOpenShift,
    warehouseId,
    terminals,
    terminalId,
    selectTerminal,
    terminalsLoading,
    terminalsError,
  } = usePosSession();

  const { data: methodsResponse } = useApiQuery<PosMethod[]>(
    ['pos-payment-methods', terminalId],
    '/pos/payment-methods',
    { terminalId: terminalId || undefined, activeOnly: true },
    { enabled: Boolean(terminalId) }
  );
  const methods = methodsResponse?.data ?? [];

  const { data: categoriesResponse } = useApiQuery<Array<{ id: string; arabicName: string }>>(
    ['pos-categories'],
    '/pos/catalog/categories',
    {}
  );
  const categories = categoriesResponse?.data ?? [];

  const { data: customersResponse } = useApiQuery<
    Array<{ id: string; arabicName: string; code?: string | null; creditLimit?: number | string | null; priceListId?: string | null }>
  >(['pos-customers', customerQuery], '/pos/catalog/customers', { q: customerQuery }, { enabled: customerQuery.trim().length > 0 });
  const customers = customersResponse?.data ?? [];

  useEffect(() => {
    if (terminal?.defaultCustomerId && !customerId) setCustomerId(terminal.defaultCustomerId);
  }, [terminal?.defaultCustomerId, customerId]);

  const loadCatalog = useCallback(
    async (reset: boolean) => {
      if (!warehouseId) return;
      try {
        const data = await apiClient.get<{ items: CatalogItem[]; nextCursor: string | null }>(
          '/pos/catalog',
          {
            warehouseId,
            customerId: customerId || undefined,
            q: search.trim() || undefined,
            categoryId: categoryId || undefined,
            cursor: reset ? undefined : cursor || undefined,
            take: 24,
          },
          { skipErrorNotify: true }
        );
        const page = data.data?.items ?? [];
        setItems((prev) => (reset ? page : [...prev, ...page]));
        setCursor(data.data?.nextCursor ?? null);
      } catch (err) {
        setError(err instanceof Error ? localizeUnknownError(err) : 'تعذر تحميل قائمة الأصناف');
      }
    },
    [warehouseId, customerId, search, categoryId, cursor]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      setCursor(null);
      void loadCatalog(true);
    }, 250);
    return () => clearTimeout(handle);
    // cursor is reset here; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, customerId, search, categoryId]);

  const refreshHeld = useCallback(async (openShiftId: string) => {
    const data = await apiClient.get<HeldOrder[]>('/pos/orders/held', { shiftId: openShiftId });
    setHeld(data.data ?? []);
  }, []);

  useEffect(() => {
    if (shiftId) void refreshHeld(shiftId);
  }, [shiftId, refreshHeld]);

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      setError((prev) => (prev.startsWith('تعذر حساب الصافي') ? '' : prev));
      publishDisplay({ phase: 'idle', lines: [], net: 0, tax: 0, discount: 0 });
      return;
    }
    const handle = setTimeout(() => {
      void apiClient
        .post<Quote>(
          '/pos/orders/quote',
          {
            customerId: customerId || undefined,
            headerDiscountPercent:
              canDiscount && headerDiscount
                ? parseOptionalDecimal(headerDiscount, { min: 0, max: 100 })
                : undefined,
            couponCode: couponCode.trim() || undefined,
            lines: buildPosLinePayload(cart, { canDiscount, canOverride }),
          },
          { skipErrorNotify: true }
        )
        .then((res) => {
          setQuote(res.data ?? null);
          setError((prev) => (prev.startsWith('تعذر حساب الصافي') ? '' : prev));
          if (res.data) {
            publishDisplay({
              phase: 'cart',
              lines: res.data.lines.map((line) => ({
                name: cart.find((row) => row.itemId === line.itemId)?.name ?? '',
                quantity: line.quantity,
                total: line.lineTotal,
                isGift: Boolean(line.isGift),
              })),
              net: res.data.netAmount,
              tax: res.data.taxAmount,
              discount: res.data.discountAmount,
            });
          }
        })
        .catch((err) => {
          setQuote(null);
          setError(`تعذر حساب الصافي: ${localizeUnknownError(err)}`);
        });
    }, 200);
    return () => clearTimeout(handle);
  }, [cart, customerId, canDiscount, canOverride, headerDiscount, couponCode]);

  const addItem = useCallback((item: CatalogItem) => {
    if (!item.unitId) {
      setError('الصنف بلا وحدة');
      return;
    }
    setError('');
    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === item.id && line.unitId === item.unitId);
      if (existing) {
        return prev.map((line) =>
          line.key === existing.key ? { ...line, quantity: money(line.quantity + 1) } : line
        );
      }
      return [
        ...prev,
        { key: `${item.id}-${Date.now()}`, itemId: item.id, unitId: item.unitId!, name: item.arabicName, quantity: item.scannedQuantity && item.scannedQuantity > 0 ? item.scannedQuantity : 1 },
      ];
    });
  }, []);

  const scan = useCallback(
    async (code: string) => {
      try {
        const res = await apiClient.get<CatalogItem>('/pos/catalog/barcode', {
          code,
          warehouseId: warehouseId || undefined,
          customerId: customerId || undefined,
        });
        if (!res.data) {
          setError(`باركود غير معروف: ${code}`);
          return;
        }
        addItem(res.data);
        setMessage(res.data.arabicName);
      } catch {
        setError(`باركود غير معروف: ${code}`);
      }
    },
    [addItem, warehouseId, customerId]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        if (code.length >= 4) {
          event.preventDefault();
          void scan(code);
        }
        return;
      }
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
      if (barcodeBuffer.current.length > 0) event.preventDefault();
      barcodeBuffer.current += event.key;
      if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
      barcodeTimer.current = setTimeout(() => {
        barcodeBuffer.current = '';
      }, 50);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scan]);

  const due = quote?.netAmount ?? 0;
  const preview = useMemo(() => {
    if (!quote) return 0;
    return quote.netAmount;
  }, [quote]);

  async function requireShift() {
    if (shiftId) return shiftId;
    const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('أدخل نقدية أول المدة قبل فتح الوردية');
      return null;
    }
    return ensureOpenShift(amount);
  }

  function linePayload() {
    return buildPosLinePayload(cart, { canDiscount, canOverride });
  }

  async function persistDraft(openShiftId: string, hold: boolean, requestId?: string | null) {
    const body = {
      shiftId: openShiftId,
      orderNumber: `POS-${Date.now()}`,
      customerId: customerId || undefined,
      notes: notes || undefined,
      headerDiscountPercent:
        canDiscount && headerDiscount
          ? parseOptionalDecimal(headerDiscount, { min: 0, max: 100 })
          : undefined,
      couponCode: couponCode.trim() || undefined,
      hold,
      clientRequestId: (requestId ?? clientRequestId) || undefined,
      lines: linePayload(),
    };
    if (draftId) {
      const updated = await apiClient.put<{ id: string; netAmount: number | string }>(`/pos/orders/${draftId}`, body);
      return updated.data;
    }
    const created = await apiClient.post<{ id: string; netAmount: number | string; orderNumber: string }>('/pos/orders', body);
    if (!hold) setDraftId(created.data?.id ?? null);
    return created.data;
  }

  async function holdCart() {
    const openShiftId = await requireShift();
    if (!openShiftId || !cart.length) return;
    setBusy(true);
    setError('');
    try {
      await persistDraft(openShiftId, true);
      setCart([]);
      setDraftId(null);
      setNotes('');
      setQuote(null);
      await refreshHeld(openShiftId);
      setMessage('تم تعليق الطلب');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التعليق');
    } finally {
      setBusy(false);
    }
  }

  async function resume(order: HeldOrder) {
    const data = await apiClient.post<HeldOrder & { lines: HeldOrder['lines'] }>(`/pos/orders/${order.id}/resume`, {});
    const row = data.data;
    if (!row) return;
    setDraftId(row.id);
    if (row.customer?.id) setCustomerId(row.customer.id);
    setNotes(row.notes ?? '');
    setCart(
      (row.lines ?? []).map((line, index) => ({
        key: `${line.itemId}-${index}`,
        itemId: line.itemId,
        unitId: line.unitId,
        name: line.item?.arabicName || 'صنف',
        quantity: Number(line.quantity),
        notes: line.notes ?? undefined,
      }))
    );
    setHeld((prev) => prev.filter((item) => item.id !== order.id));
  }

  function openPay() {
    if (!quote || due <= 0) {
      setError('أضف أصنافاً أولاً');
      return;
    }
    setPayments([
      { key: 'cash', method: 'CASH', settlementType: 'CASH', amount: String(due), tendered: String(due), reference: '' },
    ]);
    setPayOpen(true);
  }

  const paymentSum = payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const cashChange = payments
    .filter((row) => row.settlementType === 'CASH')
    .reduce((sum, row) => sum + Math.max(0, (Number(row.tendered) || 0) - (Number(row.amount) || 0)), 0);

  function paymentBody() {
    return payments.map((row) => ({
      method: row.method,
      amount: Number(row.amount),
      tenderedAmount: row.settlementType === 'CASH' ? Number(row.tendered) : undefined,
      referenceNumber: row.reference || undefined,
      currencyCode: row.currencyCode && row.currencyCode !== 'EGP' ? row.currencyCode : undefined,
      safeId: row.settlementType === 'CASH' ? terminal?.safeId : undefined,
      bankAccountId: row.settlementType === 'BANK' ? terminal?.bankAccountId ?? undefined : undefined,
    }));
  }

  function finishSale(orderNumber: string, printed?: ReceiptPayload, orderId?: string) {
    if (printed) setReceipt(toThermal(printed));
    publishDisplay({
      phase: 'paid',
      lines: [],
      net: printed?.net ?? 0,
      tax: printed?.tax ?? 0,
      discount: printed?.discount ?? 0,
      tendered: printed?.tendered,
      change: printed?.change,
    });
    setPostedOrderId(orderId ?? null);
    setReceiptLink('');
    setReceiptQr('');
    setCouponCode('');
    setCart([]);
    setDraftId(null);
    setNotes('');
    setQuote(null);
    setPayOpen(false);
    setClientRequestId(null);
    setSyncLabel('synced');
    setMessage(`تم البيع ${orderNumber}`);
    window.setTimeout(() => publishDisplay({ phase: 'idle', lines: [], net: 0, tax: 0, discount: 0 }), 4000);
  }

  async function flushOutbox() {
    const jobs = await listPosOutbox();
    for (const job of jobs) {
      if (job.status === 'conflict' || job.status === 'failed') continue;
      await updatePosOutbox(job.clientRequestId, { status: 'syncing' });
      setSyncLabel('syncing');
      try {
        const posted = await apiClient.post<{ receipt?: ReceiptPayload; orderNumber?: string; status?: string }>(
          '/pos/orders/sync',
          job.body
        );
        await removePosOutbox(job.clientRequestId);
        if (job.clientRequestId === clientRequestId) {
          finishSale(posted.data?.receipt?.orderNumber ?? posted.data?.orderNumber ?? '', posted.data?.receipt);
        }
      } catch (err) {
        const status = nextOfflineState(err);
        await updatePosOutbox(job.clientRequestId, {
          status,
          attempts: job.attempts + 1,
          lastError: err instanceof Error ? err.message : 'sync failed',
        });
        setSyncLabel(status);
        if (status === 'pending') break;
      }
    }
  }

  useEffect(() => {
    const onOnline = () => {
      void flushOutbox();
    };
    window.addEventListener('online', onOnline);
    void listPosOutbox().then((rows) => {
      if (rows.some((row) => row.status === 'pending')) setSyncLabel('pending');
    });
    return () => window.removeEventListener('online', onOnline);
    // Flush uses the latest cart key when the listener fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRequestId]);

  async function checkout() {
    const openShiftId = await requireShift();
    if (!openShiftId) return;
    const requestId = clientRequestId ?? crypto.randomUUID();
    setClientRequestId(requestId);
    setBusy(true);
    setError('');
    const queued = (await listPosOutbox()).find((row) => row.clientRequestId === requestId);
    if (queued && (queued.status === 'pending' || queued.status === 'syncing')) {
      await flushOutbox();
      setBusy(false);
      return;
    }
    const captureModes = payments.map((row) => methods.find((method) => method.code === row.method)?.captureMode ?? 'MANUAL');
    try {
      const saved = await persistDraft(openShiftId, false, requestId);
      const serverNet = Number(saved?.netAmount);
      const foreignTender = payments.some((row) => row.currencyCode && row.currencyCode !== 'EGP');
      if (!saved?.id || (!foreignTender && Math.abs(paymentSum - serverNet) > 0.01)) {
        setError('مجموع الدفع لا يساوي الصافي على الخادم');
        setQuote((prev) => (prev ? { ...prev, netAmount: serverNet } : prev));
        return;
      }
      const posted = await apiClient.post<{ id?: string; receipt?: ReceiptPayload; orderNumber?: string }>(`/pos/orders/${saved.id}/post`, {
        payments: paymentBody(),
      });
      const printed = posted.data?.receipt;
      finishSale(printed?.orderNumber ?? '', printed, posted.data?.id);
    } catch (err) {
      const eligible = canQueueOfflineSale({
        companyOffline: Boolean(settingsQuery.data?.data?.offlineEnabled),
        terminalOffline: Boolean(terminal?.offlineEnabled),
        error: err,
        captureModes,
      });
      if (!eligible) {
        setError(err instanceof Error ? err.message : 'تعذر إتمام البيع');
        setSyncLabel('');
        return;
      }
      await enqueuePosSale({
        clientRequestId: requestId,
        shiftId: openShiftId,
        createdAt: new Date().toISOString(),
        attempts: 1,
        status: 'pending',
        lastError: err instanceof Error ? err.message : undefined,
        body: {
          shiftId: openShiftId,
          orderNumber: `POS-${requestId.slice(0, 8)}`,
          customerId: customerId || undefined,
          notes: notes || undefined,
          clientRequestId: requestId,
          lines: linePayload(),
          payments: paymentBody(),
        },
      });
      setSyncLabel('pending');
      setMessage('');
      setError('لم يقبل الخادم البيع. الطلب في انتظار المزامنة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-slate-100" dir="rtl">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <PosTerminalPicker
          terminals={terminals}
          terminalId={terminalId}
          onSelect={selectTerminal}
          loading={terminalsLoading}
          error={terminalsError}
        />
        {syncLabel === 'pending' ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">بانتظار المزامنة</span> : null}
        {syncLabel === 'syncing' ? <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-900">جار المزامنة</span> : null}
        {syncLabel === 'conflict' || syncLabel === 'failed' ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-900">تعذر المزامنة</span> : null}
        <a href="/pos/returns" className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">مرتجع</a>
        <a href="/pos/session" className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">الدرج والإقفال</a>
        <input
          value={customerQuery}
          onChange={(event) => setCustomerQuery(event.target.value)}
          placeholder="بحث عميل"
          className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm"
        />
        {customers.slice(0, 4).map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => {
              setCustomerId(customer.id);
              setCustomerQuery(customer.arabicName);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${customerId === customer.id ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {customer.arabicName}
          </button>
        ))}
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="ملاحظة"
          className="h-10 min-w-32 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
        />
        {canReprint ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const number = new FormData(form).get('reprint')?.toString().trim();
              if (!number) return;
              void apiClient.get<{ id: string }>('/pos/orders/lookup', { number }).then(async (sale) => {
                if (!sale.data?.id) return;
                const printed = await apiClient.get<ReceiptPayload>(`/pos/orders/${sale.data.id}/receipt`);
                if (printed.data) setReceipt(toThermal(printed.data));
              }).catch((err) => setError(err instanceof Error ? err.message : 'تعذر إعادة الطباعة'));
            }}
          >
            <input name="reprint" placeholder="إعادة طباعة" className="h-10 w-28 rounded-lg border px-2 text-xs" />
          </form>
        ) : null}
        {!shiftId ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            نقدية أول المدة
            <input
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
              inputMode="decimal"
              className="h-10 w-28 rounded-lg border border-slate-200 px-2 text-sm"
            />
          </label>
        ) : (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">وردية مفتوحة</span>
        )}
      </header>

      {error ? <p className="bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <div className="flex min-h-0 flex-1">
        <section className="flex w-[42%] min-w-0 flex-col border-l border-slate-200 bg-white">
          <div className="flex items-center justify-between px-3 py-2">
            <h1 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShoppingCart className="h-4 w-4" /> السلة
            </h1>
            <button type="button" onClick={() => void holdCart()} disabled={busy || !cart.length} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">
              <Pause className="h-3.5 w-3.5" /> تعليق
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-2">
            {held.map((order) => (
              <button key={order.id} type="button" onClick={() => void resume(order)} className="shrink-0 rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                {order.customer?.arabicName || order.orderNumber}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3">
            {cart.map((line) => (
              <div key={line.key} className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatMoneyAr(quote?.lines.find((row) => row.itemId === line.itemId)?.price ?? 0)}
                  </p>
                  {canDiscount ? (
                    <input
                      value={line.discountPercent ?? ''}
                      onChange={(event) => setCart((prev) => prev.map((row) => row.key === line.key ? { ...row, discountPercent: event.target.value } : row))}
                      placeholder="خصم %"
                      inputMode="decimal"
                      className="mt-1 h-8 w-20 rounded border px-2 text-xs"
                    />
                  ) : null}
                  {canOverride ? (
                    <input
                      value={line.priceOverride ?? ''}
                      onChange={(event) => setCart((prev) => prev.map((row) => row.key === line.key ? { ...row, priceOverride: event.target.value } : row))}
                      placeholder="سعر"
                      inputMode="decimal"
                      className="mt-1 h-8 w-24 rounded border px-2 text-xs"
                    />
                  ) : null}
                </div>
                <button type="button" onClick={() => setCart((prev) => prev.map((row) => row.key === line.key ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row))} className="rounded-lg border p-1"><Minus className="h-4 w-4" /></button>
                <input
                  value={String(line.quantity)}
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    if (quantity > 0) setCart((prev) => prev.map((row) => row.key === line.key ? { ...row, quantity } : row));
                  }}
                  className="h-9 w-14 rounded-lg border text-center text-sm"
                />
                <button type="button" onClick={() => setCart((prev) => prev.map((row) => row.key === line.key ? { ...row, quantity: row.quantity + 1 } : row))} className="rounded-lg border p-1"><Plus className="h-4 w-4" /></button>
                <button type="button" onClick={() => setCart((prev) => prev.filter((row) => row.key !== line.key))} className="rounded-lg p-1 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <footer className="border-t border-slate-200 p-3">
            {canDiscount ? (
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                خصم الفاتورة %
                <input value={headerDiscount} onChange={(event) => setHeaderDiscount(event.target.value)} inputMode="decimal" className="h-9 w-20 rounded border px-2" />
              </label>
            ) : null}
            <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
              كوبون
              <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} className="h-9 flex-1 rounded border px-2" placeholder="كود الخصم" />
            </label>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-sm text-slate-500">الصافي من الخادم</span>
              <span className="text-2xl font-bold">{formatMoneyAr(preview)}</span>
            </div>
            <button type="button" onClick={openPay} disabled={!hasTerminal || busy} className="h-12 w-full rounded-xl bg-sky-700 text-sm font-bold text-white disabled:opacity-50">
              دفع
            </button>
          </footer>
        </section>

        <section className="flex min-w-0 flex-1 flex-col p-3">
          <div className="mb-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث عن صنف"
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="mb-2 flex gap-2 overflow-x-auto">
            <button type="button" onClick={() => setCategoryId('')} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${categoryId === '' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>الكل</button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${categoryId === category.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
                {category.arabicName}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-auto md:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => addItem(item)} className="rounded-2xl border border-slate-200 bg-white p-3 text-right hover:border-sky-400">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.arabicName}</p>
                <p className="mt-2 text-sm font-bold text-sky-800">{formatMoneyAr(item.price)}</p>
                <p className="text-[11px] text-slate-500">{item.onHand == null ? '' : `المتاح ${item.onHand}`}</p>
              </button>
            ))}
          </div>
          {cursor ? (
            <button type="button" onClick={() => void loadCatalog(false)} className="mt-2 h-10 rounded-xl bg-white text-sm font-semibold text-slate-700">
              المزيد
            </button>
          ) : null}
        </section>
      </div>

      {payOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4">
            <h2 className="mb-2 text-lg font-bold">السداد — {formatMoneyAr(due)}</h2>
            {payments.map((row) => (
              <div key={row.key} className="mb-2 grid grid-cols-4 gap-2">
                <select
                  value={row.method}
                  onChange={(event) => {
                    const method = methods.find((item) => item.code === event.target.value);
                    const systemSettlement: Record<string, string> = { GIFT_CARD: 'GIFT_CARD', STORE_CREDIT: 'STORE_CREDIT', POINTS: 'POINTS', DEPOSIT: 'DEPOSIT' };
                    setPayments((prev) => prev.map((item) => item.key === row.key ? { ...item, method: event.target.value, settlementType: method?.settlementType ?? systemSettlement[event.target.value] ?? 'BANK' } : item));
                  }}
                  className="h-10 rounded-lg border px-2 text-sm"
                >
                  {(methods.length ? methods : [{ code: 'CASH', displayName: 'نقدي', settlementType: 'CASH' as const }, { code: 'CARD', displayName: 'بطاقة', settlementType: 'BANK' as const }, { code: 'CREDIT', displayName: 'آجل', settlementType: 'CREDIT' as const }]).concat([
                    { code: 'GIFT_CARD', displayName: 'بطاقة هدية', settlementType: 'GIFT_CARD' },
                    { code: 'STORE_CREDIT', displayName: 'رصيد متجر', settlementType: 'STORE_CREDIT' },
                    { code: 'POINTS', displayName: 'نقاط', settlementType: 'POINTS' },
                    { code: 'DEPOSIT', displayName: 'عربون', settlementType: 'DEPOSIT' },
                  ]).map((method) => (
                    <option key={method.code} value={method.code}>{method.displayName}</option>
                  ))}
                </select>
                <input value={row.amount} onChange={(event) => setPayments((prev) => prev.map((item) => item.key === row.key ? { ...item, amount: event.target.value } : item))} className="h-10 rounded-lg border px-2 text-sm" placeholder="المبلغ" />
                {row.settlementType === 'CASH' || row.settlementType === 'BANK' ? (
                  <input value={row.currencyCode ?? 'EGP'} onChange={(event) => setPayments((prev) => prev.map((item) => item.key === row.key ? { ...item, currencyCode: event.target.value.toUpperCase() } : item))} className="h-10 rounded-lg border px-2 text-sm" placeholder="EGP" aria-label="العملة" />
                ) : null}
                {row.settlementType === 'CASH' ? (
                  <input value={row.tendered} onChange={(event) => setPayments((prev) => prev.map((item) => item.key === row.key ? { ...item, tendered: event.target.value } : item))} className="h-10 rounded-lg border px-2 text-sm" placeholder="المستلم" />
                ) : (
                  <input value={row.reference} onChange={(event) => setPayments((prev) => prev.map((item) => item.key === row.key ? { ...item, reference: event.target.value } : item))} className="h-10 rounded-lg border px-2 text-sm" placeholder="مرجع" />
                )}
                <button type="button" onClick={() => setPayments((prev) => prev.filter((item) => item.key !== row.key))} className="text-xs text-rose-600">حذف</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPayments((prev) => [...prev, { key: String(Date.now()), method: 'CARD', settlementType: 'BANK', amount: '', tendered: '', reference: '' }])}
              className="mb-3 text-sm font-semibold text-sky-800"
            >
              إضافة طريقة دفع
            </button>
            <p className="mb-3 text-sm text-slate-600">
              المدفوع {formatMoneyAr(paymentSum)} — المتبقي {formatMoneyAr(money(due - paymentSum))} — الباقي للعميل {formatMoneyAr(cashChange)}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void checkout()} className="h-11 flex-1 rounded-xl bg-sky-700 font-bold text-white">تأكيد</button>
              <button type="button" onClick={() => setPayOpen(false)} className="h-11 rounded-xl border px-4">إلغاء</button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <h2 className="mb-2 font-bold">إيصال {receipt.invoiceNumber}</h2>
            {receipt.fiscalLines?.[0] ? <p className="text-sm font-semibold text-sky-900">{receipt.fiscalLines[0]}</p> : null}
            <p className="text-2xl font-bold">{formatMoneyAr(receipt.net)}</p>
            {receiptQr ? <img src={receiptQr} alt="رمز الإيصال الرقمي" className="mx-auto mt-3 h-36 w-36" /> : null}
            {receiptLink ? <a href={receiptLink} className="mt-2 block break-all text-xs text-sky-800">{receiptLink}</a> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => printThermalViaBrowser(receipt, 80)} className="h-10 flex-1 rounded-lg bg-slate-900 text-sm font-semibold text-white">طباعة</button>
              {postedOrderId ? (
                <button
                  type="button"
                  className="h-10 rounded-lg border px-3 text-sm"
                  onClick={() => {
                    void apiClient.get<{ url: string }>(`/pos/commercial/orders/${postedOrderId}/receipt-link`).then(async (res) => {
                      const url = res.data?.url ? `${window.location.origin}${res.data.url}` : '';
                      setReceiptLink(url);
                      setReceiptQr(url ? await QRCode.toDataURL(url) : '');
                    }).catch((err) => setError(err instanceof Error ? err.message : 'تعذر إنشاء رابط الإيصال'));
                  }}
                >
                  إيصال رقمي
                </button>
              ) : null}
              {isWebBluetoothAvailable() ? (
                <button
                  type="button"
                  onClick={() => {
                    void renderReceiptToCanvas(receipt, { widthMm: 80 }).then(async (canvas) => {
                      const bytes = canvasToEscPos(canvas);
                      await bluetoothThermalPrinter.connectAndWrite(bytes);
                    });
                  }}
                  className="h-10 flex-1 rounded-lg border text-sm font-semibold"
                >
                  بلوتوث
                </button>
              ) : null}
              <button type="button" onClick={() => setReceipt(null)} className="h-10 rounded-lg border px-3 text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toThermal(receipt: ReceiptPayload): ThermalInvoiceData {
  return {
    companyName: receipt.companyName,
    branch: receipt.branchName,
    title: receipt.title || (receipt.orderType === 'RETURN' ? 'إيصال مرتجع' : 'إيصال نقطة البيع'),
    invoiceNumber: receipt.orderNumber,
    dateTime: receipt.postedAt ? new Date(receipt.postedAt).toLocaleString('ar-EG') : '',
    customerName: receipt.customerName,
    cashier: receipt.cashier,
    items: receipt.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.price,
      total: line.total,
    })),
    subtotal: receipt.subtotal,
    discount: receipt.discount,
    vatAmount: receipt.tax,
    net: receipt.net,
    notes: [receipt.originalOrderNumber ? `أصل الإيصال ${receipt.originalOrderNumber}` : null, receipt.notes].filter(Boolean).join(' — ') || null,
    payments: receipt.payments.map((row) => ({
      label: row.label || row.method,
      amount: row.amount,
    })),
    tendered: receipt.tendered,
    change: receipt.change,
    qrPayload: receipt.qrPayload ?? null,
    fiscalLines: [
      receipt.etaStatusLabel ? `الإيصال الإلكتروني: ${receipt.etaStatusLabel}` : null,
      receipt.etaReceiptNumber ? `رقم الإيصال الضريبي ${receipt.etaReceiptNumber}` : null,
      receipt.etaUuid ?? null,
    ].filter((line): line is string => Boolean(line)),
  };
}
