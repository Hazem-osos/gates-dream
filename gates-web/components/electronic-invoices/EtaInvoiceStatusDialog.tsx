'use client';

import { Button } from '@/components/ui';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { useApiQuery } from '@/lib/hooks/useApi';

type EtaStatusDocument = {
  id: string;
  documentType: string;
  documentTypeLabel: string;
  status: string;
  documentUuid: string | null;
  submissionUuid: string | null;
  longId: string | null;
  publicUrl: string | null;
  originalDocumentUuid: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  dateTimeIssued: string | null;
  dateTimeReceived: string | null;
  cancelledAt: string | null;
  validationErrors: unknown;
  isAmendment: boolean;
};

type EtaInvoiceStatus = {
  invoiceNumber: string | null;
  documents: EtaStatusDocument[];
};

const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_SIGNATURE: 'بانتظار التوقيع',
  PENDING: 'معلقة',
  PROCESSING: 'قيد المعالجة',
  SUBMITTED: 'مرسلة',
  VALID: 'مقبولة',
  INVALID: 'مرفوضة',
  CANCELLED: 'ملغاة',
  REJECTED: 'مرفوضة',
};

function formatWhen(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG');
}

function errorText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <span className="text-foreground-muted">{label}</span>
      <span className="break-all font-medium">{value || '—'}</span>
    </div>
  );
}

function DocumentCard({ doc }: { doc: EtaStatusDocument }) {
  const errors = errorText(doc.validationErrors);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-bold">
        {doc.isAmendment ? 'تعديل بعد الإرسال' : 'الإرسال'} — {doc.documentTypeLabel}
      </h3>
      <div className="flex flex-col gap-1.5">
        <Field label="الحالة" value={STATUS_AR[doc.status] || doc.status} />
        <Field label="أرسلها" value={doc.submittedByName?.trim() || 'غير مسجّل'} />
        <Field label="وقت الإرسال" value={formatWhen(doc.submittedAt)} />
        <Field label="UUID" value={doc.documentUuid || '—'} />
        <Field label="معرّف الإرسال" value={doc.submissionUuid || '—'} />
        <Field label="المعرّف الطويل" value={doc.longId || '—'} />
        <Field label="تاريخ الإصدار" value={formatWhen(doc.dateTimeIssued)} />
        <Field label="تاريخ الاستلام" value={formatWhen(doc.dateTimeReceived)} />
        {doc.originalDocumentUuid ? (
          <Field label="مستند الأصل" value={doc.originalDocumentUuid} />
        ) : null}
        {doc.cancelledAt ? <Field label="أُلغي في" value={formatWhen(doc.cancelledAt)} /> : null}
        {doc.publicUrl ? <Field label="رابط المصلحة" value={doc.publicUrl} /> : null}
        {errors ? <Field label="أخطاء التحقق" value={errors} /> : null}
      </div>
    </section>
  );
}

export function EtaInvoiceStatusDialog({
  invoiceId,
  onClose,
}: {
  invoiceId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useApiQuery<EtaInvoiceStatus>(
    ['eta-invoice-status', invoiceId],
    `/eta/documents/invoice/${invoiceId}/status`
  );
  const status = data?.data;
  const originals = (status?.documents ?? []).filter((doc) => !doc.isAmendment);
  const amendments = (status?.documents ?? []).filter((doc) => doc.isAmendment);

  return (
    <CenteredOverlay open onClose={onClose} width="lg" labelledBy="eta-invoice-status-title">
      <div className="flex max-h-[80vh] flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="eta-invoice-status-title" className="text-base font-bold">
            حالة الفاتورة الإلكترونية
            {status?.invoiceNumber ? ` — ${status.invoiceNumber}` : ''}
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-foreground-muted">جاري تحميل بيانات الإرسال…</p>
        ) : !status || status.documents.length === 0 ? (
          <p className="text-sm">لم تُرسل بعد</p>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {originals.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
            {amendments.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold">بيانات التعديل وحالة إرساله</h3>
                {amendments.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </CenteredOverlay>
  );
}
