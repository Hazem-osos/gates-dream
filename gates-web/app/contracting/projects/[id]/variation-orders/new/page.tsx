'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ContractVariationWorkspace } from '@/components/contracting/variation/ContractVariationWorkspace';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ClientContractDetail } from '@/lib/contracting/types';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';

export default function NewVariationOrderPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const contract = contractQ.data?.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4" dir="rtl">
      <PageHeader title="أمر تغيير جديد" breadcrumbs={[{ label: 'أوامر التغيير', href: `#` }]} />
      {!contract ? (
        <EmptyState title="العقد غير متاح" />
      ) : (
        <ContractVariationWorkspace projectId={projectId} contractId={contract.id} />
      )}
    </div>
  );
}
