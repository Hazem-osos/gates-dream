'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExecutionPlanWorkspace } from '@/components/contracting/ExecutionPlanWorkspace';

export default function ExecutionPlanPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="مخطط التنفيذ"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'مخطط التنفيذ' },
        ]}
      />
      <ExecutionPlanWorkspace projectId={params.id} />
    </div>
  );
}
