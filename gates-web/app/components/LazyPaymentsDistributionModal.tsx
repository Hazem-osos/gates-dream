'use client';

import type { ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';

const PaymentsDistributionModal = dynamic(
  () => import('@/components/PaymentsDistributionModal'),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل توزيع السدادات…" /> }
);

export default function LazyPaymentsDistributionModal(
  props: ComponentProps<typeof PaymentsDistributionModal>
) {
  if (!props.isOpen) return null;
  return <PaymentsDistributionModal {...props} />;
}
