'use client';

import { useParams, useRouter } from 'next/navigation';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectWorkspaceSkeleton } from '@/components/contracting/ContractingProjectPageShell';
import { ProjectWorkspaceTabs } from '@/components/contracting/ProjectWorkspaceTabs';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject } from '@/lib/contracting/types';

export default function ContractingProjectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    <ExtractsPageChrome
      title={project ? `${project.projectCode} — ${project.projectName}` : 'مساحة المشروع'}
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting/projects', label: 'المشاريع' },
        { label: project?.projectCode ?? 'تفاصيل' },
      ]}
      statusLabel={project?.customer?.arabicName ? `المالك: ${project.customer.arabicName}` : 'عرض'}
      favoriteHref="/contracting/projects"
      browseList={{
        title: 'المشاريع السابقة',
        apiPath: '/contracting/projects',
        listKey: 'contracting-project-workspace-browse',
        selectedId: id,
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.projectCode || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.projectName || '—') },
        ],
        onSelect: (nextId) => {
          router.push(`/contracting/projects/${nextId}/technical-office`);
        },
      }}
    >
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
    </ExtractsPageChrome>
  );
}
