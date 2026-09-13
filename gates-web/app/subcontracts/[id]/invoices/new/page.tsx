'use client';

import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { MostakhlasInvoiceEditor } from '@/components/subcontracts/MostakhlasInvoiceEditor';
import { SubcontractPageShell, SubcontractSkeleton } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

export default function NewMostakhlasPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading, isError } = useApiQuery<SubcontractDetail>(
    queryKeys.subcontracts.detail(id),
    `/subcontracts/${id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(id) }
  );
  const subcontract = data?.data;

  return (
    <SubcontractPageShell>
      <PageHeader
        title="مستخلص جديد"
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'العقد', href: `/subcontracts/${id}` },
          { label: 'مستخلص جديد' },
        ]}
      />
      {isLoading ? (
        <SubcontractSkeleton tiles={0} />
      ) : isError || !subcontract ? (
        <EmptyState title="تعذر تحميل العقد" />
      ) : subcontract.status !== 'ACTIVE' ? (
        <EmptyState title="العقد غير سارٍ" description="لا يمكن إنشاء مستخلص إلا على عقد بحالة ساري." />
      ) : (
        <MostakhlasInvoiceEditor subcontract={subcontract} />
      )}
    </SubcontractPageShell>
  );
}
