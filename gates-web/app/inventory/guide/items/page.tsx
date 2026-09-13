'use client';

import Link from 'next/link';
import { PageHeader, Button } from '@/components/ui';
import { ItemsCatalogListSection } from '@/components/inventory/ItemsCatalogListSection';

export default function ItemsGuidePage() {
  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <PageHeader
        title="دليل الأصناف"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'الدليل' },
          { label: 'الأصناف' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/guide/items/import">
              <Button variant="secondary">استيراد أصناف</Button>
            </Link>
            <Link href="/inventory/creations/item-card">
              <Button variant="primary">صنف جديد</Button>
            </Link>
          </div>
        }
      />
      <p className="mb-4 text-sm text-[#094C6B]">
        ابحث وافتح أي صنف للانتقال إلى بطاقة التعريف. الدليل للقائمة فقط — التعديل يتم من بطاقة الصنف.
      </p>
      <ItemsCatalogListSection />
    </div>
  );
}
