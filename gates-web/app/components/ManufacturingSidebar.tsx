'use client';
import { SubNavigationSidebar } from '@/app/components/navigation/SubNavigationSidebar';
import type { ModuleNavNode } from '@/lib/navigation/module-nav-types';

interface ModuleItem {
  key: string;
  icon: string;
  label: string;
  color: string;
  href?: string;
}

interface ModuleWithChildren extends ModuleItem {
  children: (ModuleItem | ModuleWithChildren)[];
}

export const manufacturingModules: ModuleWithChildren[] = [
  {
    key: 'creations',
    icon: '',
    label: 'إنشاءات التصنيع',
    color: '#0E79AA',
    children: [
      { key: 'manufacturing-stages', icon: '', label: 'مراحل التصنيع', color: '#0E79AA', href: '/manufacturing/creations/manufacturing-stages' },
      { key: 'manufacturing-model', icon: '', label: 'نموذج التصنيع', color: '#0E79AA', href: '/manufacturing/creations/manufacturing-model' },
      { key: 'manufacturing-plan', icon: '', label: 'خطة التصنيع', color: '#0E79AA', href: '/manufacturing/creations/manufacturing-plan' },
    ]
  },
  {
    key: 'operations',
    icon: '',
    label: 'عمليات التصنيع',
    color: '#0E79AA',
    children: [
      { key: 'production-orders', icon: '', label: ' عملية التصنيع', color: '#0E79AA', href: '/manufacturing/operations/operation' }
    ]
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير التصنيع',
    color: '#0E79AA',
    children: [
      { key: 'theoretical-capability', icon: '', label: 'إمكانية التصنيع النظرية', color: '#0E79AA', href: '/manufacturing/reports/theoretical-capability' },
      { key: 'cost-variance', icon: '', label: 'إنحراف تكاليف التصنيع', color: '#0E79AA', href: '/manufacturing/reports/cost-variance' },
      { key: 'invoice-variance', icon: '', label: 'إنحراف فواتير التصنيع', color: '#0E79AA', href: '/manufacturing/reports/invoice-variance' },
      { key: 'manufacturing-movements', icon: '', label: 'حركات التصنيع', color: '#0E79AA', href: '/manufacturing/reports/manufacturing-movements' },
    ]
  },
];


export default function ManufacturingSidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="manufacturing"
      modules={manufacturingModules as ModuleNavNode[]}
      collapsed={collapsed}
    />
  );
}
