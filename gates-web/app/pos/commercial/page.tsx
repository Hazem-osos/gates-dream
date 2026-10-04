'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { PosAdminNav } from '@/components/pos/PosAdminNav';
import { PosTerminalPicker, usePosSession } from '@/lib/hooks/usePosSession';

type QuoteRow = { id: string; orderNumber: string; quoteName?: string | null; expiresAt?: string | null; netAmount: number | string; customer?: { arabicName?: string } | null };
type CouponRow = { id: string; code: string; kind: string; usedCount: number; maxUses: number | null; validTo: string };
type Explain = { engine: string; applied: Array<{ id: string; nameAr?: string | null; reason: string }>; skipped: Array<{ id: string; nameAr?: string | null; reason: string }> };

export default function PosCommercialPage() {
  const { shiftId, terminal, terminalId, terminals, selectTerminal, terminalsLoading, terminalsError } = usePosSession();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const quotes = useApiQuery<QuoteRow[]>(['pos-quotes'], '/pos/commercial/quotes');
  const coupons = useApiQuery<CouponRow[]>(['pos-coupons'], '/pos/commercial/coupons');
  const [quoteName, setQuoteName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [itemId, setItemId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [qty, setQty] = useState('1');
  const [couponCode, setCouponCode] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  const [giftCode, setGiftCode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [deposit, setDeposit] = useState('');
  const [originalOrderId, setOriginalOrderId] = useState('');
  const [originalLineId, setOriginalLineId] = useState('');
  const [saleItemId, setSaleItemId] = useState('');
  const [saleUnitId, setSaleUnitId] = useState('');
  const [explain, setExplain] = useState<Explain | null>(null);
  const [availability, setAvailability] = useState<Array<{ warehouseName: string; branchName: string | null; available: number; warehouseId: string }>>([]);

  function fail(err: unknown) {
    setMessage('');
    setError(err instanceof Error ? err.message : 'تعذر التنفيذ');
  }

  const line = { itemId, unitId, quantity: Number(qty), lineOrder: 1 };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">العروض التجارية لنقطة البيع</h1>
      <PosAdminNav />
      <PosTerminalPicker terminals={terminals} terminalId={terminalId} onSelect={selectTerminal} loading={terminalsLoading} error={terminalsError} />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className="space-y-2 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">عرض سعر محفوظ</h2>
        <p className="text-xs text-slate-500">هذا ليس إيقاف السلة. العرض له اسم ورقم وصلاحية، ويتحول لاحقاً إلى مسودة بيع.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={quoteName} onChange={(event) => setQuoteName(event.target.value)} placeholder="اسم العرض" className="h-10 rounded border px-2" />
          <input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" className="h-10 rounded border px-2" />
          <input value={itemId} onChange={(event) => setItemId(event.target.value)} placeholder="معرّف الصنف" className="h-10 rounded border px-2" />
          <input value={unitId} onChange={(event) => setUnitId(event.target.value)} placeholder="معرّف الوحدة" className="h-10 rounded border px-2" />
          <input value={qty} onChange={(event) => setQty(event.target.value)} placeholder="الكمية" className="h-10 rounded border px-2" />
          <input value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="معرّف العميل" className="h-10 rounded border px-2" />
        </div>
        <button
          type="button"
          className="h-10 rounded-lg bg-slate-900 px-4 text-sm text-white"
          onClick={() => {
            if (!shiftId) return fail(new Error('افتح وردية أولاً'));
            void apiClient.post('/pos/commercial/quotes', { shiftId, quoteName, expiresAt: new Date(expiresAt).toISOString(), customerId: customerId || undefined, lines: [line] })
              .then(() => { setMessage('تم حفظ عرض السعر'); setError(''); return quotes.refetch(); })
              .catch(fail);
          }}
        >
          حفظ عرض السعر
        </button>
        <ul className="space-y-1 text-sm">
          {(quotes.data?.data ?? []).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 border-b py-1">
              <span>{row.quoteName || row.orderNumber} — {row.customer?.arabicName ?? 'بدون عميل'} — {String(row.netAmount)}</span>
              <button type="button" className="text-sky-800" onClick={() => {
                if (!shiftId) return fail(new Error('افتح وردية أولاً'));
                void apiClient.post(`/pos/commercial/quotes/${row.id}/convert`, { shiftId }).then(() => { setMessage('تحول العرض إلى مسودة بيع'); return quotes.refetch(); }).catch(fail);
              }}>تحويل لبيع</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">استبدال في عملية واحدة</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={originalOrderId} onChange={(event) => setOriginalOrderId(event.target.value)} placeholder="أمر البيع الأصلي" className="h-10 rounded border px-2" />
          <input value={originalLineId} onChange={(event) => setOriginalLineId(event.target.value)} placeholder="سطر البيع الأصلي" className="h-10 rounded border px-2" />
          <input value={saleItemId} onChange={(event) => setSaleItemId(event.target.value)} placeholder="صنف البديل" className="h-10 rounded border px-2" />
          <input value={saleUnitId} onChange={(event) => setSaleUnitId(event.target.value)} placeholder="وحدة البديل" className="h-10 rounded border px-2" />
        </div>
        <button type="button" className="h-10 rounded-lg bg-slate-900 px-4 text-sm text-white" onClick={() => {
          if (!shiftId) return fail(new Error('افتح وردية أولاً'));
          void apiClient.post('/pos/commercial/exchange', {
            shiftId,
            originalOrderId,
            returnLines: [{ originalLineId, quantity: Number(qty) }],
            saleLines: [{ itemId: saleItemId, unitId: saleUnitId, quantity: Number(qty), lineOrder: 1 }],
            customerId: customerId || undefined,
            collectMethod: 'CASH',
            refundMethod: 'CASH',
            safeId: terminal?.safeId,
          }).then(() => { setMessage('تم الاستبدال. الفرق فقط هو النقد، والمقاصة تغطي المشترك.'); setError(''); }).catch(fail);
        }}>تنفيذ الاستبدال</button>
      </section>

      <section className="space-y-2 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">كوبون</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="الكود" className="h-10 rounded border px-2" />
        </div>
        <button type="button" className="h-10 rounded-lg border px-4 text-sm" onClick={() => {
          const start = new Date();
          const end = new Date(start.getTime() + 30 * 86400000);
          void apiClient.post('/pos/commercial/coupons', { code: couponCode, kind: 'PERCENT', percent: 10, minSpend: 0, maxUses: 100, singleUsePerCustomer: true, validFrom: start.toISOString(), validTo: end.toISOString() })
            .then(() => { setMessage('تم حفظ الكوبون'); return coupons.refetch(); }).catch(fail);
        }}>كوبون 10% لعميل واحد خلال 30 يوماً</button>
        <ul className="text-sm">{(coupons.data?.data ?? []).map((row) => <li key={row.id}>{row.code} — {row.kind} — {row.usedCount}/{row.maxUses ?? '∞'}</li>)}</ul>
      </section>

      <section className="space-y-2 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">بطاقة هدية ورصيد العميل</h2>
        <div className="flex flex-wrap gap-2">
          <input value={giftAmount} onChange={(event) => setGiftAmount(event.target.value)} placeholder="المبلغ" className="h-10 rounded border px-2" />
          <input value={giftCode} onChange={(event) => setGiftCode(event.target.value)} placeholder="كود البطاقة" className="h-10 rounded border px-2" />
          <button type="button" className="h-10 rounded-lg bg-slate-900 px-3 text-sm text-white" onClick={() => {
            if (!terminal?.safeId) return fail(new Error('الجهاز بلا خزنة'));
            if (!shiftId) return fail(new Error('افتح وردية أولاً'));
            void apiClient.post('/pos/commercial/gift-cards', { amount: Number(giftAmount), code: giftCode || undefined, safeId: terminal.safeId, shiftId }).then(() => setMessage('صدرت بطاقة الهدية')).catch(fail);
          }}>إصدار</button>
          <button type="button" className="h-10 rounded-lg border px-3 text-sm" onClick={() => {
            void apiClient.get<{ balance: number }>(`/pos/commercial/gift-cards/${encodeURIComponent(giftCode)}`).then((res) => setMessage(`الرصيد ${res.data?.balance ?? ''}`)).catch(fail);
          }}>الرصيد</button>
          <button type="button" className="h-10 rounded-lg border px-3 text-sm" onClick={() => {
            if (!customerId) return fail(new Error('أدخل العميل'));
            void apiClient.get<{ storeCredit: number; points: number }>(`/pos/commercial/wallets/${customerId}`).then((res) => setMessage(`رصيد المتجر ${res.data?.storeCredit ?? 0} — النقاط ${res.data?.points ?? 0}`)).catch(fail);
          }}>محفظة العميل</button>
        </div>
        <p className="text-xs text-slate-500">رصيد المتجر والنقاط ليسا رصيد العميل الآجل. الاستخدام يتم من شاشة الدفع.</p>
      </section>

      <section className="space-y-2 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">عربون وحجز</h2>
        <div className="flex flex-wrap gap-2">
          <input value={deposit} onChange={(event) => setDeposit(event.target.value)} placeholder="مبلغ العربون" className="h-10 rounded border px-2" />
          <button type="button" className="h-10 rounded-lg bg-slate-900 px-3 text-sm text-white" onClick={() => {
            if (!shiftId || !terminal?.safeId) return fail(new Error('الوردية والخزنة مطلوبان'));
            void apiClient.post('/pos/commercial/reservations', { shiftId, amount: Number(deposit), safeId: terminal.safeId, customerId: customerId || undefined, lines: [line] })
              .then(() => setMessage('سُجّل العربون كالتزام، وليس إيراداً')).catch(fail);
          }}>حجز بعربون</button>
          <button type="button" className="h-10 rounded-lg border px-3 text-sm" onClick={() => {
            void apiClient.get<typeof availability>(`/pos/commercial/availability`, { itemId }).then((res) => setAvailability(res.data ?? [])).catch(fail);
          }}>توفر الفروع</button>
        </div>
        <ul className="text-sm">
          {availability.map((row) => (
            <li key={row.warehouseId} className="flex justify-between border-b py-1">
              <span>{row.branchName ?? 'بدون فرع'} — {row.warehouseName} — المتاح {row.available}</span>
              <button type="button" className="text-sky-800" onClick={() => {
                void apiClient.post('/pos/commercial/reservations/stock', { warehouseId: row.warehouseId, itemId, quantity: Number(qty), reason: 'حجز عميل من نقطة البيع' }).then(() => setMessage('تم حجز الكمية في المخزن')).catch(fail);
              }}>حجز</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">لماذا طُبّق العرض</h2>
        <button type="button" className="h-10 rounded-lg border px-3 text-sm" onClick={() => {
          void apiClient.get<Explain>('/pos/commercial/offers/explain', { itemId, quantity: qty, customerId: customerId || undefined }).then((res) => setExplain(res.data ?? null)).catch(fail);
        }}>فحص الصنف</button>
        {explain ? (
          <div className="text-sm">
            <p className="text-slate-600">{explain.engine}</p>
            <p className="mt-2 font-semibold">مطبق</p>
            <ul>{explain.applied.map((row) => <li key={row.id}>{row.nameAr || row.id} — {row.reason}</li>)}</ul>
            <p className="mt-2 font-semibold">غير مطبق</p>
            <ul>{explain.skipped.map((row) => <li key={row.id}>{row.nameAr || row.id} — {row.reason}</li>)}</ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
