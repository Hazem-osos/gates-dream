'use client';

import { useParams } from 'next/navigation';
import { CostElementCatalogPage } from '@/components/contracting/catalog/CostElementCatalogPage';

const MAP = {
  materials: { type: 'MATERIAL' as const, title: 'دليل المواد', href: '/contracting/catalog/cost-elements/materials' },
  labor: { type: 'LABOR' as const, title: 'دليل العمالة', href: '/contracting/catalog/cost-elements/labor' },
  equipment: { type: 'EQUIPMENT' as const, title: 'دليل المعدات', href: '/contracting/catalog/cost-elements/equipment' },
  site: { type: 'SITE_EXPENSE' as const, title: 'دليل مصروفات الموقع', href: '/contracting/catalog/cost-elements/site' },
  subcontractors: { type: 'SUBCONTRACTOR' as const, title: 'دليل مقاولي الباطن والخدمات', href: '/contracting/catalog/cost-elements/subcontractors' },
};

export default function CostElementCatalogRoutePage() {
  const { type } = useParams<{ type: string }>();
  const spec = MAP[type as keyof typeof MAP];
  if (!spec) {
    return <p className="p-4 text-sm">دليل غير معروف.</p>;
  }
  return <CostElementCatalogPage costElementType={spec.type} title={spec.title} href={spec.href} />;
}
