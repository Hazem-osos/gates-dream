'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Lock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { buildClientInvoiceGlPreview } from '@/lib/contracting/gl-preview';
import { clientInvoiceToPreview } from '@/lib/contracting/print-client-invoice';
import { CLIENT_INVOICE_LABEL } from '@/lib/contracting/labels';
import { CLIENT_INVOICE_STEPS, type ClientContractDetail, type ClientInvoice, type OwnerBoqItem } from '@/lib/contracting/types';
import { formatEgp } from '@/lib/subcontracts/money';
import { usePrintDocument } from '@/lib/documentLayout/usePrintDocument';
import { resolveDocumentLayout } from '@/lib/documentLayout/useResolvedDocumentLayout';

export function ClientInvoiceStepper({
  contract,
  invoice,
  boqItems,
  onChanged,
}: {
  contract: ClientContractDetail;
  invoice: ClientInvoice;
  boqItems: OwnerBoqItem[];
  onChanged: () => void;
}) {
  const [financeOpen, setFinanceOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const { printDocument } = usePrintDocument();
  const currentIndex = Math.max(0, (CLIENT_INVOICE_STEPS as readonly string[]).indexOf(invoice.status));
  const posted = invoice.status === 'FINANCE_POSTED' || invoice.status === 'PAID';
  const glLines = useMemo(() => buildClientInvoiceGlPreview(invoice), [invoice]);

  const mutateStatus = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'post-finance') => {
      if (action === 'post-finance') {
        return apiClient.post(`/contracting/client-billing/invoices/${invoice.id}/post-finance`, {});
      }
      return apiClient.patch(`/contracting/client-billing/invoices/${invoice.id}/${action}`, {});
    },
    onSuccess: () => {
      notifyApiSuccess('تم تحديث حالة مستخلص المالك');
      setFinanceOpen(false);
      setApproveOpen(false);
      onChanged();
    },
  });

  const printExtract = async () => {
    const config = await resolveDocumentLayout('CONTRACTOR_INVOICE');
    await printDocument(clientInvoiceToPreview(contract, invoice, boqItems), config);
  };

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {CLIENT_INVOICE_STEPS.map((step, index) => {
          const done = index < currentIndex || posted;
          const active = !posted && index === currentIndex;
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
                {CLIENT_INVOICE_LABEL[step]}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {invoice.status === 'DRAFT' ? (
          <Button isLoading={mutateStatus.isPending} onClick={() => mutateStatus.mutate('submit')}>
            تقديم للعميل
          </Button>
        ) : null}
        {invoice.status === 'SUBMITTED_TO_CLIENT' ? (
          <Button onClick={() => setApproveOpen(true)}>اعتماد العميل</Button>
        ) : null}
        {invoice.status === 'CLIENT_APPROVED' ? (
          <Button onClick={() => setFinanceOpen(true)}>الترحيل للحسابات</Button>
        ) : null}
        <Button variant="secondary" iconStart={<Printer className="h-4 w-4" />} onClick={() => void printExtract()}>
          طباعة المستخلص الرسمي
        </Button>
        {posted ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <Lock className="h-4 w-4" />
            مرحّل — قيد: {invoice.journalEntryId ?? '—'}
          </span>
        ) : null}
      </div>

      {approveOpen ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-[#0E79AA]">تأكيد اعتماد المستخلص</h2>
            <p className="text-sm text-slate-600">
              سيتم اعتماد المستخلص رقم {invoice.invoiceNumber} من العميل. الصافي المستحق {formatEgp(invoice.netPayableByClient)}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setApproveOpen(false)}>
                إلغاء
              </Button>
              <Button isLoading={mutateStatus.isPending} onClick={() => mutateStatus.mutate('approve')}>
                تأكيد الاعتماد
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {financeOpen ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-[#0E79AA]">معاينة قيد اليومية قبل الترحيل</h2>
            <ul className="space-y-2 text-sm">
              {glLines.map((line) => (
                <li key={`${line.side}-${line.label}`} className="flex justify-between gap-3 rounded-lg bg-[#F6FBFD] px-3 py-2">
                  <span>
                    <span className="ml-1 text-xs text-slate-400">{line.side === 'debit' ? 'مدين' : 'دائن'}</span>
                    {line.label}
                  </span>
                  <span className="tabular-nums font-semibold">{formatEgp(line.amount)}</span>
                </li>
              ))}
            </ul>
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
