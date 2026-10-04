'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api/client';

type Context = {
  environment: string;
  companyName: string;
  sellerRin: string;
  branchCode: string;
  activityCode: string;
  posSerial: string;
  terminalName: string;
  clientId: string;
  secretsConfigured: boolean;
  noteAr: string;
};

type Line = {
  description: string;
  itemType: 'GS1' | 'EGS';
  itemCode: string;
  internalCode: string;
  unitType: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxType: string;
  taxSubType: string;
  taxRate: number;
};

type Preview = {
  ready: boolean;
  checks: Array<{ code: string; ok: boolean; messageAr: string; propertyPath?: string }>;
  context: Context | null;
  preview: { totals: Record<string, unknown>; document: Record<string, unknown> } | null;
};

type Fiscal = {
  receiptId?: string;
  status: string;
  uuid?: string | null;
  labelAr?: string;
  isTestReceipt?: boolean;
  errors?: Array<{ errorCode: string; messageAr: string; propertyPath: string }>;
};

type ReceiptDetail = {
  id: string;
  status: string;
  uuid?: string | null;
  previousUUID?: string | null;
  frozenJson?: Record<string, unknown>;
  validationErrors?: unknown;
  etaErrors?: unknown;
  attempts?: Array<{ status?: string; httpStatus?: number; responseBody?: unknown }>;
};

const PAYMENTS = [
  { id: 'CASH', label: 'نقدي' },
  { id: 'CARD', label: 'بطاقة' },
  { id: 'CREDIT_CARD', label: 'بطاقة ائتمان (CC)' },
  { id: 'VOUCHER', label: 'قسيمة' },
  { id: 'GIFT_CARD', label: 'هدية' },
  { id: 'POINTS', label: 'نقاط' },
  { id: 'OTHER', label: 'أخرى' },
] as const;

const emptyLine = (): Line => ({
  description: '',
  itemType: 'GS1',
  itemCode: '',
  internalCode: 'TEST1',
  unitType: 'EA',
  quantity: 1,
  unitPrice: 100,
  discountAmount: 0,
  taxType: 'T1',
  taxSubType: 'V009',
  taxRate: 14,
});

export default function EreceiptTestPage() {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [buyerType, setBuyerType] = useState<'B' | 'P' | 'F'>('P');
  const [buyerId, setBuyerId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerMobile, setBuyerMobile] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]['id']>('CASH');
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Fiscal | null>(null);
  const [lifecycle, setLifecycle] = useState<ReceiptDetail | null>(null);
  const [itemQuery, setItemQuery] = useState('');
  const [itemHits, setItemHits] = useState<Array<{ id: string; arabicName: string; barcode: string | null; etaProfile: unknown }>>([]);
  const [showJson, setShowJson] = useState(false);
  const [message, setMessage] = useState('');
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());

  const payload = useMemo(() => ({
    buyerType,
    buyerId: buyerId || undefined,
    buyerName: buyerName || undefined,
    buyerMobile: buyerMobile || undefined,
    paymentNumber: paymentNumber || undefined,
    payment,
    headerDiscount,
    lines,
    clientKey,
  }), [buyerType, buyerId, buyerName, buyerMobile, paymentNumber, payment, headerDiscount, lines, clientKey]);

  useEffect(() => {
    if (!result?.receiptId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        await apiClient.post(`/electronic-receipts/receipts/${result.receiptId}/sync`, {});
      } catch {
        /* ignore sync errors while polling */
      }
      const res = await apiClient.get<ReceiptDetail>(`/electronic-receipts/receipts/${result.receiptId}`);
      if (cancelled) return;
      setLifecycle(res.data ?? null);
      const status = res.data?.status ?? '';
      if (!['QUEUED', 'SUBMITTING', 'SUBMITTED'].includes(status)) return;
      window.setTimeout(() => void poll(), 2500);
    };
    void poll();
    return () => { cancelled = true; };
  }, [result?.receiptId]);

  async function searchItems() {
    const q = itemQuery.trim();
    if (!q) return;
    const res = await apiClient.get<Array<{ id: string; arabicName: string; barcode: string | null; etaProfile: unknown }>>(
      '/electronic-receipts/test/items',
      { q },
    );
    setItemHits(res.data ?? []);
  }

  function applyItemToLine(index: number, item: { arabicName: string; barcode: string | null; etaProfile: unknown }) {
    const profile = item.etaProfile && typeof item.etaProfile === 'object' ? (item.etaProfile as Record<string, unknown>) : {};
    const itemType = profile.itemType === 'EGS' ? 'EGS' : 'GS1';
    const itemCode = typeof profile.itemCode === 'string' ? profile.itemCode : (item.barcode ?? '');
    const unitType = typeof profile.unitType === 'string' ? profile.unitType : 'EA';
    setLines((rows) => rows.map((r, i) => i === index ? {
      ...r,
      description: item.arabicName,
      itemType,
      itemCode,
      internalCode: item.barcode || r.internalCode,
      unitType,
    } : r));
  }

  useEffect(() => {
    void apiClient.get<Context>('/electronic-receipts/test/context')
      .then((res) => setCtx(res.data ?? null))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'تعذر تحميل سياق الاختبار'));
  }, []);

  async function runPreview() {
    setMessage('');
    setResult(null);
    const res = await apiClient.post<Preview>('/electronic-receipts/test/preview', payload);
    setPreview(res.data ?? null);
  }

  async function issue() {
    setMessage('');
    if (!window.confirm('سيتم إرسال هذا الإيصال إلى بيئة مصلحة الضرائب التجريبية PREPRODUCTION.\nلن يتم إنشاء فاتورة مبيعات أو حركة مخزون أو قيد محاسبي أو رصيد عميل.')) return;
    try {
      const res = await apiClient.post<Fiscal>('/electronic-receipts/test/issue', payload);
      setResult(res.data ?? null);
      setLifecycle(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر الإرسال');
    }
  }

  function applySimple() {
    setBuyerType('P');
    setBuyerId('');
    setBuyerName('');
    setPayment('CASH');
    setLines([{ ...emptyLine(), description: 'صنف تجريبي', unitPrice: 114, taxRate: 14, itemCode: '', internalCode: 'TEST' }]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">إنشاء إيصال تجريبي</h1>
        <Link href="/electronic-invoices/receipts" className="text-sm text-brand underline">العودة للإيصالات</Link>
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        {ctx?.noteAr ?? 'متاح فقط في PREPRODUCTION — لا يُستخدم في PRODUCTION.'}
      </p>
      {ctx ? (
        <div className="rounded-xl border p-3 text-sm">
          <h2 className="mb-2 font-semibold">١ — البائع / الجهاز</h2>
          <ul className="space-y-1">
            <li>الشركة: {ctx.companyName}</li>
            <li>رقم التسجيل: {ctx.sellerRin}</li>
            <li>الفرع: {ctx.branchCode} — النشاط: {ctx.activityCode}</li>
            <li>مسلسل ETA: {ctx.posSerial}</li>
            <li>البيئة: {ctx.environment}</li>
            <li>Client ID: {ctx.clientId} {ctx.secretsConfigured ? '(الأسرار مضبوطة)' : '(أكمل الأسرار من الإعدادات)'}</li>
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border p-3">
        <h2 className="mb-2 font-semibold">٢ — المشتري</h2>
        <p className="mb-2 text-xs text-slate-600">P: شخص طبيعي — دون حد 150000 ج.م يمكن ترك الهوية فارغة. B: تاجر (9 أرقام + اسم). F: أجنبي (هوية + اسم).</p>
        <div className="flex flex-wrap gap-2">
          {(['P', 'B', 'F'] as const).map((t) => (
            <button key={t} type="button" className={`rounded border px-3 py-1 ${buyerType === t ? 'bg-brand text-white' : ''}`} onClick={() => setBuyerType(t)}>{t}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input className="rounded border p-2" placeholder="الرقم / الهوية" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} />
          <input className="rounded border p-2" placeholder="الاسم" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
          <input className="rounded border p-2" placeholder="الجوال" value={buyerMobile} onChange={(e) => setBuyerMobile(e.target.value)} />
          <input className="rounded border p-2" placeholder="رقم الدفع / مرجع البطاقة (اختياري)" value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">٣ — البنود</h2>
          <button type="button" className="text-sm underline" onClick={applySimple}>استخدام أبسط إيصال تجريبي</button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="min-w-[12rem] flex-1 rounded border p-2 text-sm" placeholder="بحث صنف من Gates (اختياري)" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => void searchItems().catch((e) => setMessage(e.message))}>بحث</button>
        </div>
        {itemHits.length ? (
          <ul className="mb-3 max-h-32 overflow-auto rounded border text-sm">
            {itemHits.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1">
                <span>{item.arabicName}</span>
                <button type="button" className="text-xs text-brand underline" onClick={() => applyItemToLine(0, item)}>إضافة للبند الأول</button>
              </li>
            ))}
          </ul>
        ) : null}
        {lines.map((line, index) => (
          <div key={index} className="mb-3 grid gap-2 border-b pb-3 md:grid-cols-3">
            <input className="rounded border p-2 md:col-span-3" placeholder="الوصف" value={line.description} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, description: e.target.value } : r))} />
            <select className="rounded border p-2" value={line.itemType} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, itemType: e.target.value as 'GS1' | 'EGS' } : r))}>
              <option value="GS1">GS1</option>
              <option value="EGS">EGS</option>
            </select>
            <input className="rounded border p-2" placeholder="كود الصنف (GS1/EGS)" value={line.itemCode} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, itemCode: e.target.value } : r))} />
            <input className="rounded border p-2" placeholder="الكود الداخلي" value={line.internalCode} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, internalCode: e.target.value } : r))} />
            <input className="rounded border p-2" placeholder="الوحدة" value={line.unitType} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, unitType: e.target.value } : r))} />
            <input className="rounded border p-2" type="number" placeholder="الكمية" value={line.quantity} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, quantity: Number(e.target.value) } : r))} />
            <input className="rounded border p-2" type="number" placeholder="السعر" value={line.unitPrice} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, unitPrice: Number(e.target.value) } : r))} />
            <input className="rounded border p-2" type="number" placeholder="خصم" value={line.discountAmount} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, discountAmount: Number(e.target.value) } : r))} />
            <input className="rounded border p-2" placeholder="TaxType" value={line.taxType} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, taxType: e.target.value } : r))} />
            <input className="rounded border p-2" placeholder="SubType" value={line.taxSubType} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, taxSubType: e.target.value } : r))} />
            <input className="rounded border p-2" type="number" placeholder="نسبة الضريبة" value={line.taxRate} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, taxRate: Number(e.target.value) } : r))} />
          </div>
        ))}
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setLines((rows) => [...rows, emptyLine()])}>+ بند</button>
      </div>

      <div className="rounded-xl border p-3">
        <h2 className="mb-2 font-semibold">٤ — الدفع</h2>
        <select className="w-full rounded border p-2" value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
          {PAYMENTS.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
        <label className="mt-2 block text-sm">خصم على الإيصال</label>
        <input className="w-full rounded border p-2" type="number" value={headerDiscount} onChange={(e) => setHeaderDiscount(Number(e.target.value))} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-slate-800 px-4 py-2 text-white" onClick={() => void runPreview().catch((e) => setMessage(e.message))}>معاينة والتحقق</button>
        <button type="button" className="rounded-lg bg-brand px-4 py-2 text-white" disabled={!preview?.ready} onClick={() => void issue()}>إنشاء وإرسال إيصال تجريبي</button>
      </div>

      {message ? <p className="text-sm text-rose-700">{message}</p> : null}

      {preview?.preview?.totals ? (
        <div className="rounded-xl border p-3">
          <h2 className="font-semibold">٥ — الإجماليات</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <div><dt className="text-slate-500">إجمالي المبيعات</dt><dd>{String(preview.preview.totals.totalSales ?? '')}</dd></div>
            <div><dt className="text-slate-500">الخصم</dt><dd>{String(Number(preview.preview.totals.totalCommercialDiscount ?? 0) + Number(preview.preview.totals.totalItemsDiscount ?? 0))}</dd></div>
            <div><dt className="text-slate-500">الصافي</dt><dd>{String(preview.preview.totals.netAmount ?? '')}</dd></div>
            <div><dt className="text-slate-500">الضريبة</dt><dd>{String(preview.preview.totals.taxTotals ?? '')}</dd></div>
            <div><dt className="text-slate-500">الإجمالي</dt><dd className="font-bold">{String(preview.preview.totals.totalAmount ?? '')}</dd></div>
          </dl>
        </div>
      ) : null}

      {preview && !preview.ready ? (
        <ul className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
          {preview.checks.filter((c) => !c.ok).map((c) => <li key={c.code}>{c.messageAr} {c.propertyPath ? `(${c.propertyPath})` : ''}</li>)}
        </ul>
      ) : null}

      {preview?.preview?.document ? (
        <div className="rounded-xl border p-3">
          <h2 className="font-semibold">٦ — معاينة</h2>
          <p className="text-sm">إجمالي الإيصال: {String(preview.preview.totals.totalAmount ?? '')} — طريقة الدفع: {String(preview.preview.totals.paymentMethod ?? '')}</p>
          <button type="button" className="mt-2 text-sm underline" onClick={() => setShowJson((v) => !v)}>عرض JSON (متقدم)</button>
          {showJson ? <pre className="mt-2 max-h-96 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(preview.preview.document, null, 2)}</pre> : null}
        </div>
      ) : null}

      {(result || lifecycle) ? (
        <div className="rounded-xl border p-3 text-sm">
          <h2 className="mb-2 font-semibold">٧ — النتيجة</h2>
          <LifecycleSteps
            issued={Boolean(result?.receiptId || lifecycle?.uuid)}
            uuid={lifecycle?.uuid ?? result?.uuid}
            previousUuid={lifecycle?.previousUUID}
            status={lifecycle?.status ?? result?.status ?? ''}
            label={result?.labelAr}
          />
          {lifecycle?.status === 'INVALID' || lifecycle?.status === 'VALIDATION_FAILED' ? (
            <div className="mt-3 space-y-2 rounded border border-rose-200 bg-rose-50 p-2">
              <p className="font-semibold text-rose-800">INVALID — راجع أخطاء ETA</p>
              <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify(lifecycle.validationErrors ?? lifecycle.etaErrors ?? [], null, 2)}</pre>
              <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify(lifecycle.frozenJson ?? {}, null, 2)}</pre>
            </div>
          ) : null}
          {result?.receiptId ? (
            <Link href={`/electronic-invoices/receipts`} className="mt-3 inline-block text-brand underline" onClick={() => { /* list page */ }}>
              فتح قائمة الإيصالات
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function stepOk(done: boolean, failed?: boolean) {
  if (failed) return '✗';
  return done ? '✓' : '…';
}

function LifecycleSteps(props: {
  issued: boolean;
  uuid?: string | null;
  previousUuid?: string | null;
  status: string;
  label?: string;
}) {
  const { issued, uuid, previousUuid, status, label } = props;
  const queued = issued && ['QUEUED', 'SUBMITTING', 'SUBMITTED', 'VALID', 'INVALID', 'RETRYABLE'].includes(status);
  const submitted = ['SUBMITTED', 'VALID', 'INVALID'].includes(status);
  const valid = status === 'VALID';
  const invalid = status === 'INVALID' || status === 'VALIDATION_FAILED';
  const authOk = submitted || valid || (queued && status !== 'CONFIG_FAILED');
  return (
    <ol className="space-y-1">
      <li>إنشاء الإيصال {stepOk(issued)}</li>
      <li>UUID {uuid ? stepOk(true) : stepOk(false)} {uuid ? <span className="font-mono text-xs">{uuid}</span> : null}</li>
      <li>previousUUID {previousUuid !== undefined ? stepOk(Boolean(uuid)) : '…'} {previousUuid ? <span className="font-mono text-xs">{previousUuid || '(أول إيصال)'}</span> : null}</li>
      <li>Queued {stepOk(queued)}</li>
      <li>Authenticated / submitted {stepOk(submitted, status === 'CONFIG_FAILED')} — {status || label || '—'}</li>
      <li>ETA validation {valid ? stepOk(true) : invalid ? stepOk(false, true) : '…'} {valid ? 'VALID' : invalid ? 'INVALID' : ''}</li>
    </ol>
  );
}
