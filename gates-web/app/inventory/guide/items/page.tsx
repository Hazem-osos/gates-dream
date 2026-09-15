'use client';

import Link from 'next/link';
import { PageHeader, Button } from '@/components/ui';
import { ItemsCatalogListSection } from '@/components/inventory/ItemsCatalogListSection';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';

export default function ItemsGuidePage() {
  const { data: settingsRes } = useAccountingSettingsQuery();
  const itemAuto = settingsRes?.data?.general?.itemAutoNumbering !== false;
  const itemRecordCount = settingsRes?.data?.general?.numberingRecordCounts?.items ?? 0;
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
            <NumberingModeControl
              kind="items"
              auto={itemAuto}
              recordCount={itemRecordCount}
              settingKey="itemAutoNumbering"
            />
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
