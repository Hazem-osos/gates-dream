'use client';

import { useRouter } from 'next/navigation';
import { FixedAssetForm } from '@/components/fixed-assets/FixedAssetForm';
import { FixedAssetsPage } from '@/components/fixed-assets/shared';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';

export default function NewFixedAssetPage() {
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  return (
    <FixedAssetsPage
      title="إضافة أصل"
      description="يُحفظ الأصل كمسودة، ثم تفعّله من بطاقته: الشراء الجديد يُنشئ قيد الشراء، والأصل المسجل مسبقًا يُفعَّل بدون قيد."
      crumb={[{ label: 'سجل الأصول', href: '/fixed-assets/assets' }, { label: 'إضافة أصل' }]}
    >
      <FixedAssetForm
        onSaved={(asset) => {
          invalidate(queryKeys.fixedAssets.all);
          router.push(`/fixed-assets/assets/${asset.id}`);
        }}
      />
    </FixedAssetsPage>
  );
}
