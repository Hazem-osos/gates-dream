'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContractingProjectPageShell, ProjectWorkspaceSkeleton } from '@/components/contracting/ContractingProjectPageShell';
import { ProjectWorkspaceTabs } from '@/components/contracting/ProjectWorkspaceTabs';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject } from '@/lib/contracting/types';

export default function ContractingProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading, isError } = useApiQuery<ContractingProject>(
    queryKeys.contracting.project(id),
    `/contracting/projects/${id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(id) }
  );
  const project = data?.data;

  return (
    <ContractingProjectPageShell>
      <PageHeader
        title={project ? `${project.projectCode} — ${project.projectName}` : 'مساحة المشروع'}
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: project?.projectCode ?? 'تفاصيل' },
        ]}
        description={project?.customer?.arabicName ? `المالك: ${project.customer.arabicName}` : undefined}
      />
      {isLoading ? (
        <ProjectWorkspaceSkeleton tiles={4} />
      ) : isError || !project ? (
        <EmptyState title="تعذر تحميل المشروع" description="قد لا يتوفر المشروع على هذا الفرع أو الشركة." />
      ) : (
        <>
          <ProjectWorkspaceTabs />
          {children}
        </>
      )}
    </ContractingProjectPageShell>
  );
}
