'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { ContractingProjectPageShell, ProjectCard } from '@/components/contracting/ContractingProjectPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject } from '@/lib/contracting/types';
import { formatEgp } from '@/lib/subcontracts/money';

export default function ContractingProjectsPage() {
  const { data, isLoading, isError } = useApiQuery<ContractingProject[]>(
    queryKeys.contracting.projects(),
    '/contracting/projects',
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const projects = data?.data ?? [];

  return (
    <ContractingProjectPageShell>
      <PageHeader
        title="مساحة المشروع التنفيذية"
        description="المكتب الفني، مستخلصات المالك، خطابات الضمان، ومراقبة التكاليف."
        breadcrumbs={[{ label: 'المقاولات', href: '/contracting/extracts' }, { label: 'المشاريع' }]}
      />
      <ProjectCard>
        {isLoading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل المشاريع" description="تحقق من سياق الشركة والفرع ثم أعد المحاولة." />
        ) : projects.length === 0 ? (
          <EmptyState title="لا توجد مشاريع" description="أنشئ مشروعاً من إدارة المشاريع ثم افتح مساحة العمل التنفيذية." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="bg-[#F6FBFD] text-[#094C6B]">
                  <th className="px-3 py-2">الكود</th>
                  <th className="px-3 py-2">اسم المشروع</th>
                  <th className="px-3 py-2">العميل</th>
                  <th className="px-3 py-2">قيمة العقد</th>
                  <th className="px-3 py-2">فتح</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{project.projectCode}</td>
                    <td className="px-3 py-2">{project.projectName}</td>
                    <td className="px-3 py-2">{project.customer?.arabicName ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{formatEgp(project.contractValue)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/contracting/projects/${project.id}/technical-office`}>
                        <Button size="sm">فتح المساحة</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ProjectCard>
    </ContractingProjectPageShell>
  );
}
