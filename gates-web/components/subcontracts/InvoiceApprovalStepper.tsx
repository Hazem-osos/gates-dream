'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Lock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { toast } from '@/lib/feedback/toast';
import { formatDateAr, formatEgp, toMoney } from '@/lib/subcontracts/money';
import { buildInvoiceGlPreview } from '@/lib/subcontracts/gl-preview';
import {
  APPROVAL_STEPS,
  type SitePenalty,
  type SubcontractDetail,
  type SubcontractInvoice,
  type SubcontractInvoiceStatus,
} from '@/lib/subcontracts/types';
import { INVOICE_LABEL } from './SubcontractStatusBadge';
import { usePrintDocument } from '@/lib/documentLayout/usePrintDocument';
import { resolveDocumentLayout } from '@/lib/documentLayout/useResolvedDocumentLayout';
import { debitNoteApiToPreview, subcontractInvoiceToPreview, type ContractorDebitNoteApi } from '@/lib/documentLayout/fromDomain';

const STEP_META: Record<(typeof APPROVAL_STEPS)[number], { label: string; sub: string }> = {
  DRAFT: { label: 'مسودة', sub: 'إعداد الكميات' },
  SITE_SUBMITTED: { label: 'مقدم للموقع', sub: 'مهندس الموقع' },
  CONSULTANT_APPROVED: { label: 'معتمد استشاري', sub: 'مراجعة الغرامات' },
  TECH_OFFICE_APPROVED: { label: 'معتمد مكتب فني', sub: 'اعتماد فني' },
  FINANCE_POSTED: { label: 'مرحل حسابات', sub: 'قيود اليومية' },
};

export function InvoiceApprovalStepper({
  subcontract,
  invoice,
  onChanged,
}: {
  subcontract: SubcontractDetail;
  invoice: SubcontractInvoice;
  onChanged?: () => void;
}) {
  const [consultantOpen, setConsultantOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const { printDocument, printDocuments } = usePrintDocument();
  const currentIndex = Math.max(
    0,
    (APPROVAL_STEPS as readonly SubcontractInvoiceStatus[]).indexOf(invoice.status)
  );
  const posted = invoice.status === 'FINANCE_POSTED' || invoice.status === 'PAID';
  const glLines = useMemo(() => buildInvoiceGlPreview(invoice), [invoice]);

  const linkedPenalties = (subcontract.sitePenalties ?? []).filter(
    (row) => row.subcontractInvoiceId === invoice.id || (row.subcontractInvoiceId == null && row.status === 'APPROVED_FOR_DEDUCTION')
  );
  const linkedMaterials = (subcontract.materialReconciliations ?? []).filter(
    (row) => row.subcontractInvoiceId === invoice.id || (row.subcontractInvoiceId == null && row.status === 'PENDING_DEDUCTION')
  );

  const mutateStatus = useMutation({
    mutationFn: async (action: 'approve-consultant' | 'approve-tech-office' | 'post-finance') => {
      if (action === 'post-finance') {
        return apiClient.post(`/subcontracts/${subcontract.id}/invoices/${invoice.id}/post-finance`, {});
      }
      return apiClient.patch(`/subcontracts/${subcontract.id}/invoices/${invoice.id}/${action}`, {});
    },
    onSuccess: () => {
      notifyApiSuccess('تم تحديث حالة المستخلص');
      setConsultantOpen(false);
      setFinanceOpen(false);
      onChanged?.();
    },
  });

  const printMostakhlas = async () => {
    const config = await resolveDocumentLayout('CONTRACTOR_INVOICE');
    const data = subcontractInvoiceToPreview(subcontract, invoice);
    await printDocument(data, config);
  };

  const printDebitNotes = async () => {
    const ids = [
      ...linkedPenalties.map((row) => ({ penaltyId: row.id })),
      ...linkedMaterials.map((row) => ({ materialLogId: row.id })),
    ];
    if (!ids.length) {
      toast.error('لا توجد إشعارات خصم مرتبطة بهذا المستخلص');
      return;
    }
    const notes = await Promise.all(
      ids.map((query) => apiClient.get<ContractorDebitNoteApi>('/subcontracts/reports/debit-note', query))
    );
    const config = await resolveDocumentLayout('DEBIT_NOTE');
    const items = notes.map((res) => ({
      data: debitNoteApiToPreview(res.data ?? {}, {
        companyNameAr: config.companyNameAr,
        taxId: config.taxId,
        commercialReg: config.commercialReg,
      }),
      config,
    }));
    await printDocuments(items);
  };

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {APPROVAL_STEPS.map((step, index) => {
          const done = index < currentIndex || posted;
          const active = index === currentIndex && !posted ? true : posted && index === APPROVAL_STEPS.length - 1;
          return (
            <li
              key={step}
              className={`rounded-xl border px-3 py-3 text-sm ${
                done || active ? 'border-[#0E79AA] bg-[#F0F7FB]' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-1 flex items-center gap-2 font-bold text-[#094C6B]">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    done || active ? 'bg-[#0E79AA] text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {STEP_META[step].label}
              </div>
              <p className="text-xs text-slate-500">{STEP_META[step].sub}</p>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {invoice.status === 'SITE_SUBMITTED' ? (
          <Button onClick={() => setConsultantOpen(true)}>اعتماد الاستشاري</Button>
        ) : null}
        {invoice.status === 'CONSULTANT_APPROVED' ? (
          <Button isLoading={mutateStatus.isPending} onClick={() => mutateStatus.mutate('approve-tech-office')}>
            اعتماد المكتب الفني
          </Button>
        ) : null}
        {invoice.status === 'TECH_OFFICE_APPROVED' ? (
          <Button onClick={() => setFinanceOpen(true)}>الترحيل للحسابات وقيود اليومية</Button>
        ) : null}
        {posted ? (
          <>
            <Button variant="secondary" iconStart={<Printer className="h-4 w-4" />} onClick={() => void printMostakhlas()}>
              طباعة المستخلص
            </Button>
            <Button variant="secondary" iconStart={<Printer className="h-4 w-4" />} onClick={() => void printDebitNotes()}>
              طباعة إشعارات الخصم
            </Button>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              <Lock className="h-4 w-4" />
              مرحّل — قيد اليومية: {invoice.journalEntryId ?? '—'}
            </span>
          </>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">الحالة الحالية: {INVOICE_LABEL[invoice.status]}</p>

      {consultantOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-[#0E79AA]">مراجعة الاستشاري</h2>
            <ReviewLists penalties={linkedPenalties} materialsCount={linkedMaterials.length} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConsultantOpen(false)}>
                إغلاق
              </Button>
              <Button isLoading={mutateStatus.isPending} onClick={() => mutateStatus.mutate('approve-consultant')}>
                اعتماد الاستشاري
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {financeOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-[#0E79AA]">معاينة قيد اليومية قبل الترحيل</h2>
            <ul className="space-y-2 text-sm">
              {glLines.map((line) => (
                <li key={line.label} className="flex justify-between gap-3 rounded-lg bg-[#F6FBFD] px-3 py-2">
                  <span>
                    <span className="ml-1 text-xs text-slate-400">{line.side === 'debit' ? 'مدين' : 'دائن'}</span>
                    {line.label}
                  </span>
                  <span className="tabular-nums font-semibold">{formatEgp(line.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              مدين WIP = {formatEgp(invoice.grossCurrentAmount)} مقابل دائنو الدفعة/التأمين/الضريبة/المقاول.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setFinanceOpen(false)}>
                إلغاء
              </Button>
              <Button isLoading={mutateStatus.isPending} onClick={() => mutateStatus.mutate('post-finance')}>
                تأكيد الترحيل
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewLists({
  penalties,
  materialsCount,
}: {
  penalties: SitePenalty[];
  materialsCount: number;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h3 className="mb-1 font-semibold text-[#094C6B]">غرامات الموقع المرتبطة</h3>
        {penalties.length === 0 ? (
          <p className="text-slate-500">لا توجد غرامات معلّقة للخصم.</p>
        ) : (
          <ul className="space-y-1">
            {penalties.map((row) => (
              <li key={row.id} className="rounded-lg bg-[#F6FBFD] px-3 py-2">
                {row.penaltyType} — {formatEgp(row.amount)} — {formatDateAr(row.incidentDate)}
                <div className="text-xs text-slate-500">{row.description}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-slate-600">سجلات الهوالك المعلّقة: {materialsCount}</p>
      <p className="tabular-nums text-slate-500">إجمالي الغرامات: {formatEgp(penalties.reduce((sum, row) => sum + toMoney(row.amount), 0))}</p>
    </div>
  );
}
