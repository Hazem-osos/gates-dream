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

export default function SubPreliminaryDetailPage() {
  const params = useParams<{ id: string; certificateId: string }>();
  const subcontractId = params.id;
  const certificateId = params.certificateId;

  const { data, isLoading, isError } = useApiQuery<SubcontractDetail>(
    queryKeys.subcontracts.detail(subcontractId),
    `/subcontracts/${subcontractId}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(subcontractId) }
  );
  const subcontract = data?.data;

  return (
    <SubcontractPageShell>
      <PageHeader
        title="المستخلص الابتدائي"
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'العقد', href: `/subcontracts/${subcontractId}` },
          {
            label: 'المستخلصات الابتدائية',
            href: `/subcontracts/${subcontractId}/preliminary-certificates`,
          },
          { label: 'تفاصيل' },
        ]}
        actions={
          <Link href={`/subcontracts/${subcontractId}/preliminary-certificates`}>
            <Button variant="secondary">القائمة</Button>
          </Link>
        }
      />
      {isLoading ? (
        <SubcontractSkeleton tiles={0} />
      ) : isError || !subcontract ? (
        <EmptyState title="تعذر تحميل العقد" />
      ) : (
        <SubPreliminaryWorkspace subcontract={subcontract} certificateId={certificateId} />
      )}
    </SubcontractPageShell>
  );
}
