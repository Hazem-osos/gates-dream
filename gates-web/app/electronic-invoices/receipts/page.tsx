'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api/client';
import { EreceiptImportJsonDialog } from '@/components/electronic-invoices/ereceipt/EreceiptImportJsonDialog';

type Counts = Record<string, number>;
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  receiptType: string;
  uuid: string | null;
  previousUUID?: string | null;
  referenceUUID?: string | null;
  referenceOldUUID?: string | null;
  status: string;
  environment: string;
  dateTimeIssued: string | null;
  terminalId?: string | null;
  issueSource?: string | null;
  isTestReceipt?: boolean;
  totalAmount?: number | string | null;
  posOrder?: { orderNumber: string; netAmount: string | number } | null;
};
type SubmissionRow = {
  id: string;
  submissionUuid?: string | null;
  terminalId?: string | null;
  receiptCount?: number | null;
  acceptedCount?: number | null;
  rejectedCount?: number | null;
  status?: string | null;
};

export default function ElectronicReceiptsPage() {
  const [counts, setCounts] = useState<Counts>({});
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    const [dashboard, receipts, submissionRes] = await Promise.all([
      apiClient.get<{ counts: Counts }>('/electronic-receipts/dashboard'),
      apiClient.get<ReceiptRow[]>('/electronic-receipts/receipts'),
      apiClient.get<SubmissionRow[]>('/electronic-receipts/submissions'),
    ]);
    setCounts(dashboard.data?.counts ?? {});
    setRows(receipts.data ?? []);
    setSubmissions(submissionRes.data ?? []);
  }

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : 'تعذر التحميل'));
  }, []);

  async function openReceipt(id: string) {
    const res = await apiClient.get<Record<string, unknown>>(`/electronic-receipts/receipts/${id}`);
    setDetail(res.data ?? null);
  }

  async function act(path: string, body?: unknown) {
    setMessage('');
    try {
      await apiClient.post(path, body ?? {});
      await load();
      if (detail && typeof detail.id === 'string') await openReceipt(detail.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء');
    }
  }

  const pending = (counts.QUEUED ?? 0) + (counts.RETRYABLE ?? 0) + (counts.LATE_WINDOW ?? 0);
  const submitted = counts.SUBMITTED ?? 0;
  const valid = counts.VALID ?? 0;
  const attention =
    (counts.INVALID ?? 0) + (counts.VALIDATION_FAILED ?? 0) + (counts.CONFIG_FAILED ?? 0);

  const empty = rows.length === 0;

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">الإيصالات الإلكترونية</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/electronic-invoices/receipts/test"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          >
            إنشاء إيصال تجريبي
          </Link>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => setImportOpen(true)}
          >
            استيراد JSON
          </button>
          <Link
            href="/electronic-invoices/settings?tab=ereceipt"
            className="rounded-lg border border-brand/40 px-3 py-2 text-sm font-semibold text-brand"
          >
            الإعدادات
          </Link>
        </div>
      </div>

      <FormHelp />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <SummaryCard label="قيد الانتظار" value={pending} />
        <SummaryCard label="تم الإرسال" value={submitted} />
        <SummaryCard label="صالح" value={valid} />
        <SummaryCard label="يتطلب مراجعة" value={attention} />
      </div>

      {message ? <p className="text-sm text-rose-700">{message}</p> : null}

      {empty ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-lg font-semibold text-brand">لم يتم إرسال أي إيصالات إلكترونية بعد.</p>
          <p className="mt-2 text-sm text-foreground-muted">
            ابدأ بإكمال إعدادات الإيصال الإلكتروني، ثم أرسل أول إيصال تجريبي من بيئة PREPRODUCTION.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/electronic-invoices/settings?tab=ereceipt"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              إعداد الإيصال الإلكتروني
            </Link>
            <Link
              href="/electronic-invoices/receipts/test"
              className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              إنشاء إيصال تجريبي
            </Link>
          </div>
          <p className="mt-4 text-xs text-foreground-muted">
            في التشغيل العادي: نقطة البيع → بيع → ترحيل → Gates ينشئ الإيصال تلقائيًا ثم يُرسل إلى ETA.
          </p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <h2 className="border-b p-3 font-semibold">الإيصالات</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-right">
                <th className="p-2">رقم الإيصال</th>
                <th className="p-2">المصدر</th>
                <th className="p-2">الأمر</th>
                <th className="p-2">النوع</th>
                <th className="p-2">الجهاز</th>
                <th className="p-2">المبلغ</th>
                <th className="p-2">وقت الإصدار</th>
                <th className="p-2">حالة ETA</th>
                <th className="p-2">UUID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="cursor-pointer border-t" onClick={() => void openReceipt(row.id)}>
                  <td className="p-2">
                    {row.receiptNumber}
                    {row.isTestReceipt ? (
                      <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">إيصال تجريبي</span>
                    ) : null}
                  </td>
                  <td className="p-2 text-xs">{row.isTestReceipt ? 'اختبار PREPRODUCTION' : 'نقطة البيع'}</td>
                  <td className="p-2">{row.posOrder?.orderNumber ?? '—'}</td>
                  <td className="p-2">{row.receiptType}</td>
                  <td className="p-2 font-mono text-xs">{row.terminalId}</td>
                  <td className="p-2">{row.totalAmount ?? row.posOrder?.netAmount ?? '—'}</td>
                  <td className="p-2">{row.dateTimeIssued ? new Date(row.dateTimeIssued).toLocaleString('ar-EG') : ''}</td>
                  <td className="p-2">{row.status}</td>
                  <td className="p-2 font-mono text-xs">{row.uuid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!empty && (
        <div className="overflow-auto rounded-xl border">
          <h2 className="border-b p-3 font-semibold">الإرسالات</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-right">
                <th className="p-2">submissionUUID</th>
                <th className="p-2">الجهاز</th>
                <th className="p-2">العدد</th>
                <th className="p-2">مقبول</th>
                <th className="p-2">مرفوض</th>
                <th className="p-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{row.submissionUuid}</td>
                  <td className="p-2 font-mono text-xs">{row.terminalId}</td>
                  <td className="p-2">{row.receiptCount}</td>
                  <td className="p-2">{row.acceptedCount}</td>
                  <td className="p-2">{row.rejectedCount}</td>
                  <td className="p-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail ? (
        <div className="space-y-2 rounded-xl border p-3">
          <h2 className="font-semibold">تفاصيل {String(detail.receiptNumber ?? '')}</h2>
          {detail.issueSource === 'PREPRODUCTION_TEST' ? (
            <p className="text-sm font-semibold text-amber-800">إيصال تجريبي — لا يُنشئ فاتورة أو مخزون أو قيدًا محاسبيًا</p>
          ) : null}
          <p className="text-sm">
            الحالة {String(detail.status ?? '')} — longId {String(detail.etaLongId ?? '')}
          </p>
          <p className="font-mono text-xs break-all">UUID: {String(detail.uuid ?? '')}</p>
          <p className="font-mono text-xs break-all">previousUUID: {String(detail.previousUUID ?? '')}</p>
          <p className="font-mono text-xs break-all">
            reference: {String(detail.referenceUUID ?? detail.referenceOldUUID ?? '')}
          </p>
          {detail.qrUrl ? <p className="break-all font-mono text-xs">QR: {String(detail.qrUrl)}</p> : null}
          <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
            {JSON.stringify(detail.validationErrors ?? detail.etaErrors ?? [], null, 2)}
          </pre>
          <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
            {JSON.stringify(detail.attempts ?? [], null, 2)}
          </pre>
          <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">
            {JSON.stringify(detail.frozenJson ?? {}, null, 2)}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void act(`/electronic-receipts/receipts/${detail.id}/retry`)}>
              إعادة الإرسال
            </button>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void act(`/electronic-receipts/receipts/${detail.id}/sync`)}>
              تحديث الحالة
            </button>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void act(`/electronic-receipts/receipts/${detail.id}/correct`, {})}>
              تصحيح الإيصال المرفوض
            </button>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => window.print()}>
              طباعة / عرض QR
            </button>
          </div>
        </div>
      ) : null}

      <EreceiptImportJsonDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function FormHelp() {
  return (
    <details className="rounded-lg border bg-slate-50/80 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-brand">كيف يعمل الإيصال الإلكتروني؟</summary>
      <ol className="mt-2 list-decimal space-y-1 pr-5 text-foreground-muted">
        <li>الكاشير ينفذ عملية البيع من نقطة البيع.</li>
        <li>Gates ينشئ الإيصال الضريبي تلقائيًا بعد الترحيل.</li>
        <li>الإيصال يُرسل إلى مصلحة الضرائب.</li>
        <li>Gates يتابع نتيجة التحقق.</li>
        <li>راجع الإيصالات من هذه الصفحة.</li>
      </ol>
      <p className="mt-2 text-brand">لا تحتاج إلى إدخال UUID أو previousUUID أو JSON يدويًا.</p>
    </details>
  );
}
