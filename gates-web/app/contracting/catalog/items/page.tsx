'use client';

import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { ItemsCatalogListSection } from '@/app/components/inventory/ItemsCatalogListSection';

export default function ContractingItemsCatalogPage() {
  return (
    <ExtractsPageChrome
      title="دليل الأصناف"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'دليل الأصناف' },
      ]}
      hideSave
      favoriteHref="/contracting/catalog/items"
    >
      <p className="mb-4 text-sm text-slate-600">
        أصناف المخزون. من تحليل سعر العطاء يمكن اختيار صنف مواد من هنا أو من دليل المواد لتعبئة البيان والوحدة.
      </p>
      <ItemsCatalogListSection />
    </ExtractsPageChrome>
  );
}
