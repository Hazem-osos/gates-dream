'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubcontractVariationWorkspace } from '@/components/subcontracts/SubcontractVariationWorkspace';

export default function NewSubVariationOrderPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4" dir="rtl">
      <PageHeader title="أمر تغيير جديد — مقاول باطن" />
      <SubcontractVariationWorkspace subcontractId={params.id} />
    </div>
  );
}
