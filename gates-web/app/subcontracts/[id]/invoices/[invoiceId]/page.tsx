'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { AttachmentDropzone } from '@/components/attachments/AttachmentDropzone';
import { InvoiceApprovalStepper } from '@/components/subcontracts/InvoiceApprovalStepper';
import { InvoiceFinancialBreakdown } from '@/components/subcontracts/InvoiceFinancialBreakdown';
import { InvoiceStatusBadge } from '@/components/subcontracts/SubcontractStatusBadge';
import { SubcontractCard, SubcontractPageShell, SubcontractSkeleton } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp, formatPercent, formatQty } from '@/lib/subcontracts/money';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

export default function InvoiceDetailsPage() {
  const params = useParams<{ id: string; invoiceId: string }>();
  const invalidate = useInvalidateQuery();
  const { data, isLoading, isError } = useApiQuery<SubcontractDetail>(
    queryKeys.subcontracts.detail(params.id),
    `/subcontracts/${params.id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(params.id) }
  );
  const subcontract = data?.data;
  const invoice = subcontract?.invoices.find((row) => row.id === params.invoiceId);
  const locked = invoice?.status === 'FINANCE_POSTED' || invoice?.status === 'PAID';

  const refresh = () => {
    invalidate(queryKeys.subcontracts.detail(params.id));
    invalidate(queryKeys.subcontracts.list());
  };

  return (
    <SubcontractPageShell>
      <PageHeader
        title={invoice?.invoiceNumber ?? 'تفاصيل المستخلص'}
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'العقد', href: `/subcontracts/${params.id}` },
          { label: invoice?.invoiceNumber ?? 'المستخلص' },
        ]}
        statusBadge={invoice ? <InvoiceStatusBadge status={invoice.status} /> : undefined}
        actions={
          invoice?.status === 'DRAFT' ? (
            <Link href={`/subcontracts/${params.id}/invoices/${params.invoiceId}/edit`}>
              <Button>تعديل المسودة</Button>
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <SubcontractSkeleton />
      ) : isError || !subcontract || !invoice ? (
        <EmptyState title="تعذر تحميل المستخلص" />
      ) : (
        <>
          <SubcontractCard>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-500">المقاول</p>
                <p className="font-semibold">{subcontract.subcontractor.nameAr}</p>
              </div>
              <div>
                <p className="text-slate-500">الفترة</p>
                <p className="font-semibold">
                  {formatDateAr(invoice.periodStartDate)} — {formatDateAr(invoice.periodEndDate)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">الصافي</p>
                <p className="font-bold text-[#0E79AA]">{formatEgp(invoice.netPayableAmount)}</p>
              </div>
            </div>
            <InvoiceApprovalStepper subcontract={subcontract} invoice={invoice} onChanged={refresh} />
          </SubcontractCard>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SubcontractCard>
              <h2 className="mb-3 text-lg font-bold text-[#0E79AA]">بنود المستخلص</h2>
              <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
                <table className="w-full min-w-[720px] text-center text-sm">
                  <thead>
                    <tr className="bg-[#0E78AA] text-white">
                      <th className="px-2 py-2">البند</th>
                      <th className="px-2 py-2">سابق</th>
                      <th className="px-2 py-2">حالي</th>
                      <th className="px-2 py-2">تراكمي</th>
                      <th className="px-2 py-2">الإنجاز</th>
                      <th className="px-2 py-2">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items ?? []).map((item, index) => {
                      const boq = subcontract.boqItems.find((row) => row.id === item.subcontractBOQItemId);
                      return (
                        <tr key={item.id ?? item.subcontractBOQItemId} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                          <td className="px-2 py-2 text-right">
                            <div className="font-semibold">{boq?.itemCode}</div>
                            <div className="text-xs text-slate-500">{boq?.descriptionAr}</div>
                          </td>
                          <td className="px-2 py-2 tabular-nums">{formatQty(item.previousQuantity)}</td>
                          <td className="px-2 py-2 tabular-nums">{formatQty(item.currentQuantity)}</td>
                          <td className="px-2 py-2 tabular-nums">{formatQty(item.totalCumulativeQuantity)}</td>
                          <td className="px-2 py-2 tabular-nums">{formatPercent(item.completionPercentage)}</td>
                          <td className="px-2 py-2 tabular-nums">{formatEgp(item.totalCurrentAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {locked ? (
                <p className="mt-3 text-sm text-emerald-700">المستخلص مرحّل ومقفول — لا يمكن تعديل الكميات.</p>
              ) : null}
            </SubcontractCard>
            <InvoiceFinancialBreakdown invoice={invoice} />
          </div>
          <SubcontractCard>
            <AttachmentDropzone
              title="مرفقات المستخلص"
              defaultCategory="SIGNED_INVOICE_COPY"
              links={{
                subcontractId: subcontract.id,
                subcontractInvoiceId: invoice.id,
                entityType: 'SUBCONTRACT_INVOICE',
                entityId: invoice.id,
              }}
            />
          </SubcontractCard>
        </>
      )}
    </SubcontractPageShell>
  );
}
