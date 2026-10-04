'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { OwnerPreliminaryWorkspace } from '@/components/contracting/preliminary/OwnerPreliminaryWorkspace';
import type { ClientContractDetail } from '@/lib/contracting/types';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';

export default function OwnerPreliminaryDetailPage() {
  const params = useParams<{ id: string; certificateId: string }>();
  const projectId = params.id;
  const certificateId = params.certificateId;

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
        title="تفاصيل المستخلص الابتدائي"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'المستخلصات الابتدائية', href: `/contracting/projects/${projectId}/preliminary-certificates` },
          { label: 'تفاصيل' },
        ]}
        actions={
          <Link href={`/contracting/projects/${projectId}/preliminary-certificates`}>
            <Button variant="secondary">العودة للقائمة</Button>
          </Link>
        }
      />
      {!contract ? (
        <EmptyState title="العقد غير متاح" />
      ) : (
        <OwnerPreliminaryWorkspace projectId={projectId} contractId={contract.id} certificateId={certificateId} />
      )}
    </div>
  );
}
