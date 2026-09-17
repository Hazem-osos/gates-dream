'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { ItemsCatalogListSection } from '@/components/inventory/ItemsCatalogListSection';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';

export default function ItemsGuidePage() {
  const { data: settingsRes } = useAccountingSettingsQuery();
  const itemAuto = settingsRes?.data?.general?.itemAutoNumbering !== false;
  const itemRecordCount = settingsRes?.data?.general?.numberingRecordCounts?.items ?? 0;
  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'الدليل' },
          { label: 'الأصناف' },
        ]}
        title="دليل الأصناف"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/inventory/guide/items"
        favoriteLabel="دليل الأصناف"
        extraActions={
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
    </ErpDocumentLayout>
  );
}
