'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { OwnerPreliminaryWorkspace } from '@/components/contracting/preliminary/OwnerPreliminaryWorkspace';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ClientContractDetail } from '@/lib/contracting/types';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';

export default function NewOwnerPreliminaryPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const contract = contractQ.data?.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="مستخلص ابتدائي جديد"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'مستخلصات المالك', href: `/contracting/projects/${projectId}/client-billing` },
          { label: 'المستخلصات الابتدائية', href: `/contracting/projects/${projectId}/preliminary-certificates` },
          { label: 'جديد' },
        ]}
        actions={
          <Link href={`/contracting/projects/${projectId}/preliminary-certificates`}>
            <Button variant="secondary">القائمة</Button>
          </Link>
        }
      />
      {!contract ? (
        <EmptyState title="سجّل عقد المالك أولاً" />
      ) : (
        <OwnerPreliminaryWorkspace projectId={projectId} contractId={contract.id} />
      )}
    </div>
  );
}
