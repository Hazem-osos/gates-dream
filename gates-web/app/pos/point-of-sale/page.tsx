'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Pause, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { StatusBadge, compactControlClass } from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  computePosCartTotals,
  createEmptyPosCartLine,
  type PosCartLine,
} from '@/lib/pos/computePosCartTotals';
import { submitPosWave2Order, usePosSession } from '@/lib/hooks/usePosSession';
import { findItemByBarcode, type BarcodeItemHit } from '@/lib/inventory/findItemByBarcode';
import { formatMoneyAr } from '@/lib/formatMoney';
import type { ApiError } from '@/lib/api/types';
import { PosTenderModal, type PosTenderMethod } from '@/components/pos/PosTenderModal';

type PosLookupRow = BarcodeItemHit & {
  defaultUnitId?: string;
  itemGroupId?: string | null;
  itemGroup?: { id: string; arabicName?: string } | null;
  onHandQuantity?: number | null;
};

type ItemGroupRow = { id: string; arabicName: string };

type PosDailyRow = {
  id?: string;
  invoiceNumber?: string;
  netAmount?: number | string;
  paidAmount?: number | string;
};

type HeldTicket = {
  id: string;
  customerName: string;
  lines: PosCartLine[];
  heldAt: string;
};

function itemPrice(item: PosLookupRow): number {
  if (typeof item.salesPrice === 'number' && Number.isFinite(item.salesPrice)) return item.salesPrice;
  const def = item.itemPrices?.find((p) => p.priceList?.isDefault) ?? item.itemPrices?.[0];
  return Number(def?.price ?? 0) || 0;
}

function itemCodeOf(item: PosLookupRow): string {
  return (item.code || item.serial || '').trim();
}

function unitLabelOf(item: PosLookupRow): string {
  const base = item.units?.find((u) => u.isBaseUnit) ?? item.units?.[0];
  return base?.unit?.arabicName || base?.unit?.code || '';
}

export default function PointOfSalePage() {
  const invalidateQuery = useInvalidateQuery();
  const { displayName } = useCurrentUserProfile();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [barcodeScan, setBarcodeScan] = useState('');
  const [activeGroupId, setActiveGroupId] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showTender, setShowTender] = useState(false);
  const [tenderMethod, setTenderMethod] = useState<PosTenderMethod>('نقدى');
  const [tenderPaid, setTenderPaid] = useState('');
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [formData, setFormData] = useState({
    startDate: '',
    startTime: '10:30',
    customerName: '',
    description: '',
    allowDeletion: '',
    sellerName: '',
    pointOfSale: '',
    pilotName: '',
    returnsInvoice: false,
    total: '0.00',
    net: '0.00',
    taxable: '0.00',
    paid: '0.00',
    paymentMethod: 'كاش',
    remaining: '0.00',
  });

  const [warehouseId, setWarehouseId] = useState('');
  const [cartLines, setCartLines] = useState<PosCartLine[]>(
    Array.from({ length: 7 }, (_, i) => createEmptyPosCartLine(i + 1))
  );

  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showWaitingListModal, setShowWaitingListModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { data: warehousesResponse } = useApiQuery<PosLookupRow[]>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true, leafOnly: true }
  );
  const warehouses = useMemo(() => warehousesResponse?.data ?? [], [warehousesResponse?.data]);

  const { data: customersResponse } = useApiQuery<PosLookupRow[]>(
    ['customers'],
    '/accounting/customers',
    { limit: 1000, isActive: true }
  );
  const customers = customersResponse?.data ?? [];

  const { data: itemsResponse } = useApiQuery<PosLookupRow[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const items = useMemo(() => itemsResponse?.data ?? [], [itemsResponse?.data]);

  const { data: groupsResponse } = useApiQuery<ItemGroupRow[]>(
    ['item-groups-pos'],
    '/inventory/item-groups',
    { limit: 200, isActive: true }
  );
  const itemGroups = groupsResponse?.data ?? [];

  const {
    shiftId,
    shiftStats,
    hasTerminal,
    ensureOpenShift,
    refetchOpenShift,
  } = usePosSession(warehouseId);

  const { data: dailyReportResponse } = useApiQuery<PosDailyRow[]>(
    ['pos-daily-report-pos', formData.startDate, warehouseId],
    '/pos/daily-report',
    { date: formData.startDate || undefined, warehouseId: warehouseId || undefined },
    { enabled: !!warehouseId && !!formData.startDate && showDailyModal }
  );
  const dailySummary = (dailyReportResponse?.summary ?? {}) as {
    totalAmount?: number;
    totalPaid?: number;
  };

  const posSaleMutation = useApiMutation<unknown, Record<string, unknown>>('/pos/sales', 'POST', {
    onSuccess: () => {
      setSuccess('تم حفظ عملية البيع بنجاح');
      invalidateQuery(['pos-sales']);
    },
    onError: (err: ApiError) => {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, startDate: today }));
  }, []);

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
      setFormData((prev) => ({
        ...prev,
        pointOfSale: warehouses[0].arabicName ?? prev.pointOfSale,
      }));
    }
  }, [warehouses, warehouseId]);

  const cartTotals = useMemo(
    () => computePosCartTotals(cartLines.filter((l) => l.quantity > 0)),
    [cartLines]
  );
  const activeLines = useMemo(
    () => cartLines.filter((l) => l.quantity > 0 && l.itemCode),
    [cartLines]
  );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      total: cartTotals.formatted.total,
      net: cartTotals.formatted.net,
      taxable: cartTotals.formatted.taxable,
      paid: cartTotals.formatted.paid,
      remaining: cartTotals.formatted.remaining,
    }));
  }, [cartTotals]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const upsertItem = useCallback((item: PosLookupRow) => {
    const code = itemCodeOf(item);
    if (!code) return;
    const linePatch: PosCartLine = {
      id: `line-${Date.now()}`,
      barcode: item.barcode || item.serial || code,
      itemCode: code,
      itemName: item.arabicName || '',
      unitLabel: unitLabelOf(item),
      price: itemPrice(item),
      quantity: 1,
      discountPercent: 0,
      discountAmount: 0,
      taxPercent: Number(item.defaultTaxPercent ?? 0) || 0,
    };
    setCartLines((lines) => {
      const existing = lines.find((l) => l.itemCode === code);
      if (existing) {
        return lines.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      const empty = lines.find((l) => !l.itemCode);
      if (empty) return lines.map((l) => (l.id === empty.id ? { ...linePatch, id: empty.id } : l));
      return [...lines, linePatch];
    });
  }, []);

  const handleBarcodeEnter = async () => {
    const scan = barcodeScan.trim();
    if (!scan) return;
    const found = (await findItemByBarcode(scan, items)) as PosLookupRow | null;
    if (!found) {
      setError(`الصنف ${scan} غير موجود`);
      return;
    }
    upsertItem(found);
    setBarcodeScan('');
    barcodeRef.current?.focus();
  };

  const patchLine = (id: string, patch: Partial<PosCartLine>) => {
    setCartLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const clearCart = () => {
    setCartLines(Array.from({ length: 7 }, (_, i) => createEmptyPosCartLine(i + 1)));
  };

  const holdTicket = () => {
    if (activeLines.length === 0) {
      setError('لا توجد أصناف لتعليقها');
      return;
    }
    setHeldTickets((prev) => [
      {
        id: `hold-${Date.now()}`,
        customerName: formData.customerName,
        lines: cartLines,
        heldAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
    clearCart();
    setSuccess('تم تعليق الفاتورة');
  };

  const restoreTicket = (ticket: HeldTicket) => {
    setCartLines(ticket.lines);
    setFormData((prev) => ({ ...prev, customerName: ticket.customerName }));
    setHeldTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    setShowWaitingListModal(false);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const linesToSave = cartLines.filter((l) => l.quantity > 0 && l.itemCode);
    if (linesToSave.length === 0) {
      setError('يرجى إضافة أصناف للسلة');
      return;
    }
    if (!warehouseId) {
      setError('يرجى اختيار نقطة البيع / المخزن');
      return;
    }

    const paymentMethodMap: Record<string, 'cash' | 'card' | 'multiple' | 'credit'> = {
      كاش: 'cash',
      نقدى: 'cash',
      فيزا: 'card',
      آجل: 'credit',
      card: 'card',
      cash: 'cash',
      credit: 'credit',
    };

    for (const line of linesToSave) {
      const item = items.find((it) => it.code === line.itemCode || it.serial === line.itemCode);
      if (!item?.id) {
        setError(`الصنف ${line.itemCode || '—'} غير موجود في الدليل`);
        return;
      }
    }

    const mappedLines = linesToSave.map((line, idx) => {
      const item = items.find((it) => it.code === line.itemCode || it.serial === line.itemCode)!;
      const unitId = item.defaultUnitId ?? item.units?.find((u) => u.isBaseUnit)?.unitId ?? item.id;
      return {
        itemId: item.id,
        unitId,
        quantity: line.quantity,
        price: line.price,
        discountAmount: line.discountAmount || undefined,
        taxPercent: line.taxPercent || undefined,
        lineOrder: idx + 1,
      };
    });

    const net = cartTotals.net;
    const tenderToForm: Record<PosTenderMethod, string> = { نقدى: 'كاش', فيزا: 'فيزا', آجل: 'آجل' };
    const selectedPay = showTender ? tenderToForm[tenderMethod] : formData.paymentMethod;
    const legacyMethod = paymentMethodMap[selectedPay] ?? 'cash';
    const customerId = selectedCustomerId || customers[0]?.id;

    try {
      if (hasTerminal) {
        const openShiftId = shiftId ?? (await ensureOpenShift());
        if (!openShiftId) {
          setError('تعذر فتح وردية نقطة البيع — تحقق من إعداد الطرفية');
          return;
        }

        const wavePayment =
          legacyMethod === 'card'
            ? 'CARD'
            : legacyMethod === 'credit'
              ? 'CREDIT'
              : legacyMethod === 'multiple'
                ? 'SPLIT'
                : 'CASH';
        const cashAmount = wavePayment === 'CASH' ? net : wavePayment === 'SPLIT' ? net / 2 : 0;
        const cardAmount = wavePayment === 'CARD' ? net : wavePayment === 'SPLIT' ? net - cashAmount : 0;
        const creditAmount = wavePayment === 'CREDIT' ? net : 0;

        const orderNumber = `POS-${Date.now()}`;
        await submitPosWave2Order({
          shiftId: openShiftId,
          orderNumber,
          paymentMethod: wavePayment,
          cashAmount,
          cardAmount,
          creditAmount,
          customerId,
          lines: mappedLines,
        });
        setSuccess('تم حفظ عملية البيع وترحيلها على الوردية');
        invalidateQuery(['pos-open-shift']);
        invalidateQuery(['pos-sales-recent']);
        await refetchOpenShift();
        clearCart();
        setShowTender(false);
        return;
      }

      posSaleMutation.mutate({
        date: formData.startDate,
        currencyCode: 'EGP',
        warehouseId,
        customerId,
        paymentMethod: legacyMethod === 'credit' ? 'cash' : legacyMethod,
        description: formData.description || 'POS Sale',
        lines: linesToSave.map((line, idx) => {
          const item = items.find((it) => it.code === line.itemCode || it.serial === line.itemCode)!;
          const unitId = item.defaultUnitId ?? item.units?.find((u) => u.isBaseUnit)?.unitId ?? item.id;
          return {
            itemId: item.id,
            unitId,
            quantity: line.quantity,
            baseQuantity: line.quantity,
            price: line.price,
            discountPercent: line.discountPercent || undefined,
            discountAmount: line.discountAmount || undefined,
            taxPercent: line.taxPercent || undefined,
            lineOrder: idx + 1,
          };
        }),
      });
      clearCart();
      setShowTender(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const openTender = () => {
    if (activeLines.length === 0) {
      setError('يرجى إضافة أصناف للسلة');
      return;
    }
    setTenderPaid(String(cartTotals.net || ''));
    setShowTender(true);
  };

  const confirmTender = () => {
    const mapped: Record<PosTenderMethod, string> = { نقدى: 'كاش', فيزا: 'فيزا', آجل: 'آجل' };
    setFormData((prev) => ({ ...prev, paymentMethod: mapped[tenderMethod] }));
    void handleSave();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.key !== 'F2' && e.key !== 'F4' && e.key !== 'F9') {
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        holdTicket();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        openTender();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLines.length, cartLines, formData.customerName]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim();
    return items.filter((item) => {
      if (activeGroupId !== 'all' && item.itemGroupId !== activeGroupId && item.itemGroup?.id !== activeGroupId) {
        return false;
      }
      if (!q) return true;
      const hay = `${item.arabicName ?? ''} ${item.code ?? ''} ${item.barcode ?? ''} ${item.serial ?? ''}`;
      return hay.includes(q);
    });
  }, [items, activeGroupId, catalogSearch]);

  const cashier = formData.sellerName || displayName || 'كاشير';

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden bg-white" dir="rtl">
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-bold text-slate-900">نقطة البيع السريعة</h1>
          <StatusBadge
            label={shiftId ? 'وردية مفتوحة' : 'لا توجد وردية'}
            tone={shiftId ? 'success' : 'warning'}
            compact
          />
          <span className="text-xs text-slate-600">{cashier}</span>
          <select
            className={`${compactControlClass} h-8 w-44`}
            value={warehouseId}
            onChange={(e) => {
              const next = warehouses.find((w) => w.id === e.target.value);
              setWarehouseId(e.target.value);
              handleInputChange('pointOfSale', next?.arabicName ?? '');
            }}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.arabicName || w.code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span className="rounded-md bg-[#0E79AA0D] px-2 py-1 text-[#0E79AA]">F2: بحث</span>
          <span className="rounded-md bg-[#0E79AA0D] px-2 py-1 text-[#0E79AA]">F4: تعليق</span>
          <span className="rounded-md bg-[#0E79AA0D] px-2 py-1 text-[#0E79AA]">F9: دفع</span>
          {shiftStats ? (
            <span className="tabular-nums">مبيعات الوردية {formatMoneyAr(shiftStats.totalMerchandise)}</span>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex w-[45%] min-w-[320px] flex-col border-l border-slate-200 bg-white">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={barcodeRef}
                autoFocus
                value={barcodeScan}
                onChange={(e) => setBarcodeScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleBarcodeEnter();
                  }
                }}
                placeholder="امسح الباركود أو اكتب الكود ثم Enter"
                className={`${compactControlClass} h-10 pr-9`}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                className={compactControlClass}
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  const c = customers.find((x) => x.id === e.target.value);
                  handleInputChange('customerName', c?.arabicName ?? '');
                }}
              >
                <option value="">عميل نقدي</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.arabicName}
                  </option>
                ))}
              </select>
              <input
                className={compactControlClass}
                placeholder="اسم البائع"
                value={formData.sellerName}
                onChange={(e) => handleInputChange('sellerName', e.target.value)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            {activeLines.length === 0 ? (
              <EmptyState title="السلة فارغة — امسح باركود أو اختر صنفاً." />
            ) : (
              <ul className="space-y-2 pb-3">
                {activeLines.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-lg border border-slate-200/80 p-2.5 hover:bg-slate-50/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{line.itemName || line.itemCode}</p>
                        <p className="text-[11px] text-slate-500">
                          {line.itemCode} · {formatMoneyAr(line.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => patchLine(line.id, { quantity: 0, itemCode: '', itemName: '' })}
                        className="text-slate-400 hover:text-rose-600"
                        aria-label="حذف السطر"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200"
                        onClick={() => patchLine(line.id, { quantity: Math.max(0, line.quantity - 1) })}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        className="h-8 w-14 rounded-md border border-slate-200 text-center text-sm tabular-nums"
                        value={line.quantity}
                        onChange={(e) => patchLine(line.id, { quantity: Number(e.target.value) || 0 })}
                      />
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200"
                        onClick={() => patchLine(line.id, { quantity: line.quantity + 1 })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        className="h-8 w-20 rounded-md border border-slate-200 px-2 text-xs tabular-nums"
                        placeholder="خصم"
                        value={line.discountAmount || ''}
                        onChange={(e) =>
                          patchLine(line.id, { discountAmount: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="ms-auto text-sm font-bold tabular-nums text-slate-900">
                        {formatMoneyAr(line.price * line.quantity - (line.discountAmount || 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>الإجمالي</span>
                <span className="tabular-nums">{formatMoneyAr(cartTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>الخصم / الضريبة</span>
                <span className="tabular-nums">{formatMoneyAr(cartTotals.net - cartTotals.taxable)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>الخاضع للضريبة</span>
                <span className="tabular-nums">{formatMoneyAr(cartTotals.taxable)}</span>
              </div>
              <div className="mt-2 flex items-end justify-between rounded-xl bg-[#0E79AA0D] px-3 py-2">
                <span className="text-xs font-semibold text-[#0E79AA]">الصافي</span>
                <span className="text-2xl font-bold tabular-nums text-[#0E79AA]">{formatMoneyAr(cartTotals.net)}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={openTender}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0E79AA] text-sm font-semibold text-white hover:bg-[#0B6188]"
              >
                <ShoppingCart className="h-4 w-4" />
                دفع (F9)
              </button>
              <button
                type="button"
                onClick={holdTicket}
                className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
              >
                <Pause className="h-4 w-4" />
                تعليق
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <button type="button" className="text-[#0E79AA]" onClick={() => setShowWaitingListModal(true)}>
                قائمة الانتظار ({heldTickets.length})
              </button>
              <button type="button" className="text-[#0E79AA]" onClick={() => setShowDailyModal(true)}>
                اليومية
              </button>
              <button type="button" className="text-[#0E79AA]" onClick={() => setShowWarehouseModal(true)}>
                كميات المخزن
              </button>
              <button type="button" className="text-[#0E79AA]" onClick={() => setShowSettingsModal(true)}>
                إعدادات
              </button>
            </div>
          </div>
        </section>

        <section className="flex w-[55%] min-w-0 flex-col bg-slate-50/50 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveGroupId('all')}
              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                activeGroupId === 'all'
                  ? 'bg-[#0E79AA] text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              الكل
            </button>
            {itemGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroupId(g.id)}
                className={`h-8 rounded-full px-3 text-xs font-semibold ${
                  activeGroupId === g.id
                    ? 'bg-[#0E79AA] text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {g.arabicName}
              </button>
            ))}
          </div>
          <input
            className={`${compactControlClass} mb-3 h-9`}
            placeholder="بحث في الأصناف"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCatalog.slice(0, 80).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => upsertItem(item)}
                  className="rounded-xl border border-slate-200/80 bg-white p-3 text-right transition-colors hover:border-[#0E79AA] hover:bg-[#0E79AA0D]"
                >
                  <p className="truncate text-sm font-semibold text-slate-900">{item.arabicName}</p>
                  <p className="text-[11px] text-slate-500">{item.code || item.serial}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold tabular-nums text-[#0E79AA]">
                      {formatMoneyAr(itemPrice(item))}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      مخزون {item.onHandQuantity ?? '—'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <PosTenderModal
        open={showTender}
        net={cartTotals.net}
        method={tenderMethod}
        paid={tenderPaid}
        onMethodChange={setTenderMethod}
        onPaidChange={setTenderPaid}
        onClose={() => setShowTender(false)}
        onConfirm={confirmTender}
        busy={posSaleMutation.isPending}
      />

      {showWaitingListModal ? (
        <SimpleModal title="قائمة الانتظار (فواتير معلّقة)" onClose={() => setShowWaitingListModal(false)}>
          {heldTickets.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد فواتير معلّقة</p>
          ) : (
            <ul className="space-y-2">
              {heldTickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                  <span className="text-sm">
                    {t.customerName || 'عميل نقدي'} · {t.heldAt}
                  </span>
                  <button type="button" className="text-xs font-semibold text-[#0E79AA]" onClick={() => restoreTicket(t)}>
                    استعادة
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SimpleModal>
      ) : null}

      {showDailyModal ? (
        <SimpleModal title="يومية نقطة البيع" onClose={() => setShowDailyModal(false)}>
          <p className="text-sm text-slate-600">
            إجمالي {formatMoneyAr(dailySummary.totalAmount)} · محصّل {formatMoneyAr(dailySummary.totalPaid)}
          </p>
        </SimpleModal>
      ) : null}

      {showWarehouseModal ? (
        <SimpleModal title="كميات أصناف المخازن" onClose={() => setShowWarehouseModal(false)}>
          <p className="text-sm text-slate-500">اختر صنفاً من الكتالوج لعرض الرصيد على البلاطة.</p>
        </SimpleModal>
      ) : null}

      {showSettingsModal ? (
        <SimpleModal title="إعدادات نقطة البيع" onClose={() => setShowSettingsModal(false)}>
          <label className="mb-1 block text-xs font-semibold text-slate-600">الشرح</label>
          <input
            className={compactControlClass}
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
          />
          <div className="mt-3">
            <ActionButtons
              onSave={() => setShowSettingsModal(false)}
              onCancel={() => {
                clearCart();
                setShowSettingsModal(false);
              }}
              saveText="تم"
            />
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}

function SimpleModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            إغلاق
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
