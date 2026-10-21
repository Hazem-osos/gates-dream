'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Map } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { ExtractsExecutionPlanBoard } from '@/components/extracts/ExtractsExecutionPlanBoard';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject } from '@/lib/contracting/types';

export default function ExtractsExecutionPlanPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get('projectId') ?? '';

  const { data } = useApiQuery<ContractingProject[]>(
    queryKeys.contracting.projects(),
    '/contracting/projects',
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const projects = data?.data ?? [];

  const projectId = useMemo(() => {
    if (paramProjectId && projects.some((p) => p.id === paramProjectId)) return paramProjectId;
    return projects[0]?.id ?? '';
  }, [paramProjectId, projects]);

  useEffect(() => {
    if (!projects.length) return;
    if (projectId && paramProjectId !== projectId) {
      const q = new URLSearchParams(searchParams.toString());
      q.set('projectId', projectId);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [projects, projectId, paramProjectId, pathname, router, searchParams]);

  const onProjectChange = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (id) q.set('projectId', id);
    else q.delete('projectId');
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <ExtractsPageChrome
      title="مخطط التنفيذ"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/extracts/operations/projects', label: 'إدارة المشاريع' },
        { label: 'مخطط التنفيذ' },
      ]}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/projects/execution-plan"
      hideSave
      browseList={{
        title: 'المشاريع',
        apiPath: '/contracting/projects',
        listKey: 'extract-execution-plan-browse',
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.projectCode || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.projectName || '—') },
        ],
        onSelect: (id) => onProjectChange(id),
      }}
    >
      <FormSectionCard title="المشروع" subtitle="بنود العطاء والتوزيع للمشروع التنفيذي" icon={Map}>
        <CompactFormField label="المشروع">
          <select
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className={compactControlClass}
          >
            {projects.length === 0 ? (
              <option value="">لا توجد مشاريع تنفيذية</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName} — {p.projectCode}
                </option>
              ))
            )}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <ExtractsExecutionPlanBoard projectId={projectId} />
    </ExtractsPageChrome>
  );
}
