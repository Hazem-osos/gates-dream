'use client';

import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { MostakhlasInvoiceEditor } from '@/components/subcontracts/MostakhlasInvoiceEditor';
import { SubcontractPageShell, SubcontractSkeleton } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

export default function EditMostakhlasPage() {
  const params = useParams<{ id: string; invoiceId: string }>();
  const { data, isLoading, isError } = useApiQuery<SubcontractDetail>(
    queryKeys.subcontracts.detail(params.id),
    `/subcontracts/${params.id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(params.id) }
  );
  const subcontract = data?.data;
  const invoice = subcontract?.invoices.find((row) => row.id === params.invoiceId);

  return (
    <SubcontractPageShell>
      <PageHeader
        title={invoice ? `تعديل ${invoice.invoiceNumber}` : 'تعديل المستخلص'}
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'العقد', href: `/subcontracts/${params.id}` },
          { label: invoice?.invoiceNumber ?? 'المستخلص', href: `/subcontracts/${params.id}/invoices/${params.invoiceId}` },
          { label: 'تعديل' },
        ]}
      />
      {isLoading ? (
        <SubcontractSkeleton tiles={0} />
      ) : isError || !subcontract || !invoice ? (
        <EmptyState title="تعذر تحميل المستخلص" />
      ) : invoice.status !== 'DRAFT' ? (
        <EmptyState title="المستخلص غير قابل للتعديل" description="يمكن تعديل المسودات فقط. انتقل لصفحة الاعتماد للمتابعة." />
      ) : (
        <MostakhlasInvoiceEditor subcontract={subcontract} invoice={invoice} />
      )}
    </SubcontractPageShell>
  );
}
