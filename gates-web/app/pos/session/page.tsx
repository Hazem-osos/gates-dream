'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { PosTerminalPicker, usePosSession } from '@/lib/hooks/usePosSession';
import { formatMoneyAr } from '@/lib/formatMoney';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';

type Equation = {
  openingCash: number;
  grossSales: number;
  netSales: number;
  returnsNet: number;
  cashSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number | null;
  orderCount: number;
  returnCount: number;
  paymentBreakdown: Record<string, { sales: number; refunds: number }>;
};

type Snapshot = Equation & {
  countedCash: number;
  variance: number;
  terminalName: string;
  cashierId?: string | null;
  openedAt: string;
  closedAt: string;
};

type Readiness = {
  shortageConfigured: boolean;
  surplusConfigured: boolean;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default function PosSessionPage() {
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
  const permissions = useResourcePermissions({ resource: 'pos', module: 'pos' });
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState<Record<number, string>>({ 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' });
  const denominationTotal = Object.entries(notes).reduce((sum, [value, count]) => sum + Number(value) * (Number(count) || 0), 0);
  const usingDenominations = Object.values(notes).some((count) => Number(count) > 0);
  const [handoverUser, setHandoverUser] = useState('');
  const [controlReason, setControlReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<Equation | null>(null);
  const [closed, setClosed] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [moving, setMoving] = useState(false);
  const [closing, setClosing] = useState(false);

  const [accountQuery, setAccountQuery] = useState('');
  const accounts = useApiQuery<Array<{ id: string; code?: string; arabicName: string }>>(
    ['pos-close-accounts', accountQuery],
    '/pos/shifts/accounts',
    { q: accountQuery, limit: 20 },
    { enabled: Boolean(shiftId) }
  );
  const readiness = useApiQuery<Readiness>(['pos-variance-readiness'], '/pos/shifts/readiness', {});

  useEffect(() => {
    setCounted('');
    setConfirming(false);
    setClosed(null);
    setPreview(null);
    if (!shiftId) return;
    let cancelled = false;
    setLoadingPreview(true);
    setError('');
    apiClient
      .get<{ equation: Equation }>(`/pos/shifts/${shiftId}/reconciliation`)
      .then((res) => {
        if (!cancelled) setPreview(res.data?.equation ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل مطابقة الدرج');
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId]);

  async function reloadPreview() {
    if (!shiftId) return;
    setLoadingPreview(true);
    setError('');
    try {
      const res = await apiClient.get<{ equation: Equation }>(`/pos/shifts/${shiftId}/reconciliation`);
      setPreview(res.data?.equation ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مطابقة الدرج');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function move(type: 'CASH_IN' | 'CASH_OUT') {
    if (!shiftId) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('أدخل مبلغ الحركة');
      return;
    }
    if (!reason.trim()) {
      setError('اكتب سبب الحركة');
      return;
    }
    if (!accountId) {
      setError('اختر الحساب المقابل');
      return;
    }
    setError('');
    setMoving(true);
    try {
      await apiClient.post(`/pos/shifts/${shiftId}/cash-movements`, {
        type,
        amount: value,
        reason: reason.trim(),
        contraAccountId: accountId,
      });
      setAmount('');
      setReason('');
      await reloadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الحركة');
    } finally {
      setMoving(false);
    }
  }

  const countedNumber = usingDenominations ? denominationTotal : counted.trim() === '' ? null : Number(counted);
  const countedValid = countedNumber != null && Number.isFinite(countedNumber) && countedNumber >= 0;
  const variance =
    countedValid && preview && countedNumber != null && preview.expectedCash != null
      ? round2(countedNumber - preview.expectedCash)
      : null;

  async function closeSession() {
    if (!shiftId || !countedValid || countedNumber == null) {
      setError('أدخل النقدية المعدودة في الدرج');
      return;
    }
    setError('');
    setClosing(true);
    try {
      const denominations = usingDenominations
        ? Object.entries(notes).filter(([, count]) => Number(count) > 0).map(([value, count]) => ({ value: Number(value), count: Number(count) }))
        : undefined;
      const res = await apiClient.post<{ snapshot: Snapshot }>(`/pos/shifts/${shiftId}/close`, {
        closingCashDeclared: countedNumber,
        denominations,
      });
      setClosed(res.data?.snapshot ?? null);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإقفال');
    } finally {
      setClosing(false);
    }
  }

  const readinessData = readiness.data?.data;
  const missingVarianceAccounts =
    readinessData && (!readinessData.shortageConfigured || !readinessData.surplusConfigured);

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
      <h1 className="mb-1 text-xl font-bold">درج الكاشير وإقفال الوردية</h1>
      {terminal ? <p className="mb-3 text-sm text-slate-600">الجهاز: {terminal.name}</p> : null}
      {missingVarianceAccounts ? (
        <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          إقفال الوردية بفرق نقدي سيتوقف حتى يُضبط
          {!readinessData?.shortageConfigured ? ' حساب العجز' : ''}
          {!readinessData?.shortageConfigured && !readinessData?.surplusConfigured ? ' و' : ''}
          {!readinessData?.surplusConfigured ? ' حساب الزيادة' : ''}
          {' '}من إعدادات حسابات الشركة. الإقفال بدون فرق يبقى متاحاً. لا يتم إنشاء الحسابات تلقائياً.
        </p>
      ) : null}
      {error ? <p className="mb-2 text-sm text-rose-700">{error}</p> : null}
      {choiceReady && !terminalId ? (
        <p className="text-sm text-slate-600">اختر جهاز نقطة البيع لعرض ورديته. المخزن لا يحدد الجهاز.</p>
      ) : null}
      {terminalId && !shiftId && !closed ? (
        <p className="text-sm text-slate-600">لا توجد وردية مفتوحة على {terminal?.name ?? 'هذا الجهاز'}.</p>
      ) : null}
      {loadingPreview ? <p className="mb-2 text-sm text-slate-500">جاري تحميل مطابقة الدرج…</p> : null}
      {shiftId && !closed ? (
        <div className="mb-4 rounded-2xl border bg-white p-4">
          <h2 className="mb-2 font-semibold">نقدية داخلة / خارجة</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="المبلغ" inputMode="decimal" className="h-10 rounded-lg border px-2" />
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="السبب" className="h-10 rounded-lg border px-2" />
            <input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="بحث في دليل الحسابات" className="h-10 rounded-lg border px-2 sm:col-span-2" />
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="h-10 rounded-lg border px-2 sm:col-span-2">
              <option value="">الحساب المقابل</option>
              {(accounts.data?.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>{account.code} {account.arabicName}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={moving} onClick={() => void move('CASH_IN')} className="h-10 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">نقدية داخلة</button>
            <button type="button" disabled={moving} onClick={() => void move('CASH_OUT')} className="h-10 rounded-lg bg-amber-700 px-3 text-sm font-bold text-white disabled:opacity-50">نقدية خارجة</button>
          </div>
        </div>
      ) : null}
      {terminalId ? (
        <div className="mb-4 rounded-2xl border bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">تحكم الكاشير</h2>
          <input value={controlReason} onChange={(event) => setControlReason(event.target.value)} placeholder="السبب" className="mb-2 h-10 w-full rounded-lg border px-2" />
          <div className="flex flex-wrap gap-2">
            {permissions.can('no_sale') ? (
              <button type="button" className="h-10 rounded-lg border px-3" onClick={() => void apiClient.post('/pos/commercial/no-sale', { terminalId, shiftId: shiftId ?? undefined, reason: controlReason }).then(() => setError('')).catch((err) => setError(err instanceof Error ? err.message : 'تعذر فتح الدرج'))}>فتح الدرج بدون بيع</button>
            ) : null}
            {permissions.can('lock_terminal') ? (
              <button type="button" className="h-10 rounded-lg border px-3" onClick={() => void apiClient.post(`/pos/commercial/terminals/${terminalId}/lock`, { locked: true, reason: controlReason }).catch((err) => setError(err instanceof Error ? err.message : 'تعذر قفل الجهاز'))}>قفل الجهاز</button>
            ) : null}
            {permissions.can('handover') && shiftId ? (
              <>
                <input value={handoverUser} onChange={(event) => setHandoverUser(event.target.value)} placeholder="مستخدم الاستلام" className="h-10 rounded-lg border px-2" />
                <button type="button" className="h-10 rounded-lg border px-3" onClick={() => void apiClient.post('/pos/commercial/handover', { shiftId, toUserId: handoverUser, reason: controlReason }).catch((err) => setError(err instanceof Error ? err.message : 'تعذر تسليم الوردية'))}>تسليم الوردية</button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {preview && !closed ? (
        <div className="rounded-2xl border bg-white p-4 text-sm">
          <Row label="أول المدة" value={preview.openingCash} />
          <Row label="إجمالي المبيعات" value={preview.grossSales} />
          <Row label="صافي المبيعات" value={preview.netSales} />
          <Row label="المرتجعات" value={preview.returnsNet} />
          <Row label="نقدي المبيعات" value={preview.cashSales} />
          <Row label="نقدي المرتجعات" value={preview.cashRefunds} />
          <Row label="نقدية داخلة" value={preview.cashIn} />
          <Row label="نقدية خارجة" value={preview.cashOut} />
          <Row label="المتوقع في الدرج" value={preview.expectedCash} />
          <p className="mt-2 text-slate-500">عدد الفواتير {preview.orderCount} — المرتجعات {preview.returnCount}</p>
          <p className="mt-2 text-xs text-slate-500">المتوقع للعرض فقط. اكتب النقدية المعدودة فعلياً في الدرج، أو عدّ الفئات فيحسبها النظام.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.keys(notes).map((value) => (
              <label key={value} className="text-xs text-slate-600">
                {value}
                <input
                  value={notes[Number(value)] ?? ''}
                  onChange={(event) => {
                    setNotes((prev) => ({ ...prev, [Number(value)]: event.target.value }));
                    setConfirming(false);
                  }}
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded border px-2"
                  aria-label={`عدد فئة ${value}`}
                />
              </label>
            ))}
          </div>
          {usingDenominations ? <p className="mt-2 text-sm">مجموع الفئات {formatMoneyAr(denominationTotal)}</p> : null}
          <div className="mt-3 flex gap-2">
            <input
              value={counted}
              onChange={(event) => {
                setCounted(event.target.value);
                setConfirming(false);
              }}
              className="h-11 flex-1 rounded-xl border px-3"
              placeholder="النقدية المعدودة"
              inputMode="decimal"
              aria-label="النقدية المعدودة"
            />
            <button
              type="button"
              disabled={!countedValid}
              onClick={() => setConfirming(true)}
              className="h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
            >
              مراجعة الإقفال
            </button>
          </div>
          {confirming && variance != null && countedNumber != null ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <Row label="المعدود" value={countedNumber} />
              <Row label="العجز / الزيادة" value={variance} />
              <p className="mb-2 text-xs text-slate-600">
                {variance === 0
                  ? 'لا يوجد فرق. الإقفال لا يحتاج حساب عجز أو زيادة.'
                  : variance < 0
                    ? 'عجز نقدي. يلزم حساب العجز المضبوط.'
                    : 'زيادة نقدية. يلزم حساب الزيادة المضبوط.'}
              </p>
              <button
                type="button"
                disabled={closing}
                onClick={() => void closeSession()}
                className="h-11 rounded-xl bg-slate-900 px-4 font-bold text-white disabled:opacity-50"
              >
                تأكيد الإقفال
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {closed ? (
        <div className="rounded-2xl border bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">لقطة الإقفال</h2>
          <Row label="أول المدة" value={closed.openingCash} />
          <Row label="نقدي المبيعات" value={closed.cashSales} />
          <Row label="نقدي المرتجعات" value={closed.cashRefunds} />
          <Row label="نقدية داخلة" value={closed.cashIn} />
          <Row label="نقدية خارجة" value={closed.cashOut} />
          <Row label="المتوقع في الدرج" value={closed.expectedCash} />
          <Row label="المعدود" value={closed.countedCash} />
          <Row label="العجز / الزيادة" value={closed.variance} />
          <p className="mt-2 text-slate-500">{closed.terminalName} — {closed.cashierId}</p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1">
      <span>{label}</span>
      <span className="font-semibold">{value == null ? 'مخفي حتى إدخال الجرد' : formatMoneyAr(value)}</span>
    </div>
  );
}
