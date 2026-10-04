'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { MetricTile, ProjectCard } from '@/components/contracting/ContractingProjectPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject } from '@/lib/contracting/types';
import { formatDateAr } from '@/lib/subcontracts/money';

const QUICK_LINKS = [
  { href: 'technical-office', label: 'جدول الكميات (BOQ)' },
  { href: 'client-billing', label: 'مستخلصات المالك' },
  { href: 'preliminary-certificates', label: 'مستخلصات ابتدائية' },
  { href: 'variation-orders', label: 'أوامر التغيير' },
  { href: 'actual-cost', label: 'التكلفة الفعلية' },
  { href: 'profitability', label: 'مراقبة وربحية المشروع' },
  { href: 'execution-plan', label: 'مخطط التنفيذ' },
  { href: 'performance', label: 'أداء المشروع' },
] as const;

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useApiQuery<ContractingProject>(
    queryKeys.contracting.project(id),
    `/contracting/projects/${id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(id) }
  );
  const project = data?.data;

  if (isLoading || !project) {
    return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="كود المشروع" value={project.projectCode} />
        <MetricTile label="اسم المشروع" value={project.projectName} />
        <MetricTile label="المالك" value={project.customer?.arabicName ?? '—'} />
        <MetricTile
          label="تاريخ البدء"
          value={project.startDate ? formatDateAr(project.startDate) : '—'}
        />
      </div>

      <ProjectCard title="مساحة عمل المشروع" actions={<LayoutDashboard className="h-5 w-5 text-brand" />}>
        <p className="mb-4 text-sm text-muted-foreground">
          انتقل إلى منطقة العمل المناسبة من التبويبات أعلاه أو من الاختصارات التالية.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={`/contracting/projects/${id}/${link.href}`}
                className="block rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm font-bold text-brand transition-colors hover:bg-[var(--info-soft)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </ProjectCard>
    </div>
  );
}
