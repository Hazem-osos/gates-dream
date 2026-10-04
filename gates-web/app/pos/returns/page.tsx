'use client';

import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { printThermalViaBrowser } from '@/lib/printer/rawbt-fallback';
import type { ThermalInvoiceData } from '@/lib/printer/types';
import { PosTerminalPicker, usePosSession } from '@/lib/hooks/usePosSession';
import { formatMoneyAr } from '@/lib/formatMoney';

type SaleLine = {
  id: string;
  item?: { arabicName?: string };
  soldQuantity: number;
  remainingQuantity: number;
  price: number | string;
  lineTotal?: number | string;
};

type Sale = {
  id: string;
  orderNumber: string;
  netAmount: number | string;
  customer?: { arabicName?: string } | null;
  lines: SaleLine[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default function PosReturnsPage() {
  const {
    shiftId,
    terminal,
    terminals,
    terminalId,
    selectTerminal,
    terminalsLoading,
    terminalsError,
    choiceReady,
  } = usePosSession();
  const [number, setNumber] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'CREDIT'>('CASH');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refundEstimate = useMemo(() => {
    if (!sale) return 0;
    return round2(
      sale.lines.reduce((sum, line) => {
        const quantity = Number(qty[line.id] || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) return sum;
        const sold = Number(line.soldQuantity) || 1;
        const lineNet = Number(line.lineTotal ?? line.price);
        return sum + (lineNet * quantity) / sold;
      }, 0)
    );
  }, [sale, qty]);

  async function findSale() {
    if (!number.trim()) {
      setError('أدخل رقم الإيصال');
      setSale(null);
      return;
    }
    setError('');
    setMessage('');
    setLooking(true);
    try {
      const res = await apiClient.get<Sale>('/pos/orders/lookup', { number: number.trim() });
      if (!res.data) {
        setSale(null);
        setError('لا يوجد إيصال بهذا الرقم');
        return;
      }
      setSale(res.data);
      const next: Record<string, string> = {};
      for (const line of res.data.lines ?? []) next[line.id] = String(line.remainingQuantity);
      setQty(next);
    } catch (err) {
      setSale(null);
      setError(err instanceof Error ? err.message : 'تعذر البحث عن الإيصال');
    } finally {
      setLooking(false);
    }
  }

  function setLineQty(line: SaleLine, raw: string) {
    const value = Number(raw);
    if (raw !== '' && Number.isFinite(value) && value > line.remainingQuantity) {
      setQty((prev) => ({ ...prev, [line.id]: String(line.remainingQuantity) }));
      setError(`الكمية المتاحة للمرتجع ${line.remainingQuantity}`);
      return;
    }
    setError('');
    setQty((prev) => ({ ...prev, [line.id]: raw }));
  }

  async function submitReturn() {
    if (!sale || !shiftId) {
      setError(terminal ? `افتح وردية على ${terminal.name} أولاً` : 'اختر الجهاز وافتح وردية أولاً');
      return;
    }
    const lines = sale.lines
      .map((line) => ({ originalLineId: line.id, quantity: Number(qty[line.id] || 0) }))
      .filter((line) => line.quantity > 0);
    if (!lines.length) {
      setError('حدد كمية مرتجع');
      return;
    }
    const over = lines.find((line) => {
      const source = sale.lines.find((row) => row.id === line.originalLineId);
      return source != null && line.quantity > source.remainingQuantity;
    });
    if (over) {
      setError('كمية المرتجع أكبر من المتبقي');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ netAmount?: number | string; orderNumber?: string; receipt?: { title?: string; companyName: string; branchName?: string; orderNumber: string; postedAt?: string; cashier?: string | null; customerName?: string | null; originalOrderNumber?: string | null; notes?: string | null; subtotal: number; discount: number; tax: number; net: number; lines: Array<{ name: string; quantity: number; price: number; total: number }>; payments: Array<{ label?: string; method: string; amount: number }>; tendered: number; change: number } }>('/pos/orders/returns', {
        shiftId,
        originalOrderId: sale.id,
        lines,
        payments: [{ method, amount: refundEstimate }],
      });
      const refunded = Number(res.data?.receipt?.net ?? res.data?.netAmount ?? refundEstimate);
      const printed = res.data?.receipt;
      if (printed) {
        const thermal: ThermalInvoiceData = {
          companyName: printed.companyName,
          branch: printed.branchName,
          title: printed.title || 'إيصال مرتجع',
          invoiceNumber: printed.orderNumber,
          dateTime: printed.postedAt ? new Date(printed.postedAt).toLocaleString('ar-EG') : '',
          customerName: printed.customerName,
          cashier: printed.cashier,
          items: printed.lines.map((line) => ({ name: line.name, quantity: line.quantity, unitPrice: line.price, total: line.total })),
          subtotal: printed.subtotal,
          discount: printed.discount,
          vatAmount: printed.tax,
          net: printed.net,
          notes: printed.originalOrderNumber ? `أصل الإيصال ${printed.originalOrderNumber}` : printed.notes,
          payments: printed.payments.map((row) => ({ label: row.label || row.method, amount: row.amount })),
          tendered: printed.tendered,
          change: printed.change,
        };
        printThermalViaBrowser(thermal, 80);
      }
      setMessage(`تم المرتجع ${res.data?.orderNumber ?? printed?.orderNumber ?? ''} بمبلغ ${formatMoneyAr(refunded)}`);
      setSale(null);
      setNumber('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر المرتجع');
    } finally {
      setSubmitting(false);
    }
  }

  const noRemaining = sale != null && sale.lines.every((line) => line.remainingQuantity <= 0);

  return (
    <div className="mx-auto max-w-3xl p-4" dir="rtl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PosTerminalPicker
          terminals={terminals}
          terminalId={terminalId}
          onSelect={selectTerminal}
          loading={terminalsLoading}
          error={terminalsError}
        />
        <a href="/pos/point-of-sale" className="text-sm font-semibold text-sky-800">العودة للبيع</a>
      </div>
      <h1 className="mb-1 text-xl font-bold">مرتجع نقطة البيع</h1>
      {terminal ? <p className="mb-3 text-sm text-slate-600">الجهاز: {terminal.name}</p> : null}
      {choiceReady && !terminalId ? (
        <p className="mb-3 text-sm text-slate-600">اختر جهاز نقطة البيع. المرتجع يُسجَّل على وردية هذا الجهاز.</p>
      ) : null}
      {terminalId && !shiftId ? (
        <p className="mb-3 text-sm text-amber-800">لا توجد وردية مفتوحة على {terminal?.name}. افتح الوردية من شاشة البيع قبل المرتجع.</p>
      ) : null}
      {error ? <p className="mb-2 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="mb-2 text-sm text-emerald-700">{message}</p> : null}
      <div className="mb-4 flex gap-2">
        <input
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          placeholder="رقم الإيصال"
          className="h-11 flex-1 rounded-xl border px-3"
          aria-label="رقم الإيصال"
        />
        <button type="button" disabled={looking} onClick={() => void findSale()} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">
          {looking ? 'جاري البحث…' : 'بحث'}
        </button>
      </div>
      {!sale && !looking && !error ? <p className="text-sm text-slate-500">ابحث برقم إيصال بيع مرحّل.</p> : null}
      {sale ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="font-semibold">{sale.orderNumber} — {sale.customer?.arabicName || 'نقدي'}</p>
          <p className="mb-3 text-sm text-slate-500">صافي الإيصال {formatMoneyAr(Number(sale.netAmount))}</p>
          {sale.lines.length === 0 ? <p className="text-sm text-slate-500">لا توجد بنود على هذا الإيصال.</p> : null}
          {noRemaining ? <p className="mb-2 text-sm text-amber-800">تم إرجاع الكمية بالكامل.</p> : null}
          {sale.lines.map((line) => (
            <div key={line.id} className="mb-2 flex items-center gap-2">
              <div className="flex-1 text-sm">
                {line.item?.arabicName || 'صنف'} — المتبقي {line.remainingQuantity} من {line.soldQuantity}
              </div>
              <input
                value={qty[line.id] ?? ''}
                onChange={(event) => setLineQty(line, event.target.value)}
                className="h-10 w-24 rounded-lg border text-center"
                inputMode="decimal"
                aria-label={`كمية مرتجع ${line.item?.arabicName || ''}`}
                disabled={line.remainingQuantity <= 0}
              />
            </div>
          ))}
          <select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="mb-3 h-10 rounded-lg border px-2">
            <option value="CASH">استرداد نقدي</option>
            <option value="CARD">استرداد بطاقة</option>
            <option value="CREDIT">تخفيض مديونية</option>
          </select>
          <p className="mb-3 text-sm">مبلغ الاسترداد {formatMoneyAr(refundEstimate)}. الخادم يثبت الصافي من سعر البيع الأصلي.</p>
          <button
            type="button"
            disabled={submitting || !shiftId || noRemaining}
            onClick={() => void submitReturn()}
            className="h-11 w-full rounded-xl bg-sky-700 font-bold text-white disabled:opacity-50"
          >
            {submitting ? 'جاري المرتجع…' : 'تنفيذ المرتجع'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
