'use client';

import { ItemsGuideScreen } from '@/app/inventory/guide/items/page';

export default function ContractingItemsCatalogPage() {
  return (
    <ItemsGuideScreen
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'دليل الأصناف' },
      ]}
      favoriteHref="/contracting/catalog/items"
    />
  );
}
