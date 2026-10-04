'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubcontractVariationWorkspace } from '@/components/subcontracts/SubcontractVariationWorkspace';

export default function SubVariationOrderDetailPage() {
  const params = useParams<{ id: string; variationOrderId: string }>();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4" dir="rtl">
      <PageHeader title="تفاصيل أمر التغيير" />
      <SubcontractVariationWorkspace
        subcontractId={params.id}
        variationOrderId={params.variationOrderId}
      />
    </div>
  );
}
