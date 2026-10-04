'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SubPreliminaryWorkspace } from '@/components/contracting/preliminary/SubPreliminaryWorkspace';
import { SubcontractPageShell, SubcontractSkeleton } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

export default function NewSubPreliminaryPage() {
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
        title="مستخلص ابتدائي جديد"
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'العقد', href: `/subcontracts/${id}` },
          {
            label: 'المستخلصات الابتدائية',
            href: `/subcontracts/${id}/preliminary-certificates`,
          },
          { label: 'جديد' },
        ]}
        actions={
          <Link href={`/subcontracts/${id}/preliminary-certificates`}>
            <Button variant="secondary">القائمة</Button>
          </Link>
        }
      />
      {isLoading ? (
        <SubcontractSkeleton tiles={0} />
      ) : isError || !subcontract ? (
        <EmptyState title="تعذر تحميل العقد" />
      ) : subcontract.status !== 'ACTIVE' ? (
        <EmptyState title="العقد غير سارٍ" />
      ) : (
        <SubPreliminaryWorkspace subcontract={subcontract} />
      )}
    </SubcontractPageShell>
  );
}
