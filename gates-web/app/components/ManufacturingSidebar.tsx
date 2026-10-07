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
    color: '#0E78AA',
    children: [
      { key: 'manufacturing-model', icon: '', label: 'نموذج التصنيع / قائمة المواد', color: '#0E78AA', href: '/manufacturing/creations/manufacturing-model' },
      { key: 'item-alternatives', icon: '', label: 'تعريف البدائل', color: '#0E78AA', href: '/manufacturing/creations/item-alternatives' },
    ]
  },
  {
    key: 'operations',
    icon: '',
    label: 'عمليات التصنيع',
    color: '#0E78AA',
    children: [
      {
        key: 'sales-order',
        icon: '',
        label: 'أمر البيع',
        color: '#0E78AA',
        href: '/manufacturing/operations/sales-order',
      },
      {
        key: 'work-order',
        icon: '',
        label: 'أمر الشغل',
        color: '#0E78AA',
        href: '/manufacturing/operations/production-planning',
      },
      { key: 'production-orders', icon: '', label: 'أمر التصنيع', color: '#0E78AA', href: '/manufacturing/operations/operation' },
    ]
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير التصنيع',
    color: '#0E78AA',
    children: [
      { key: 'theoretical-capability', icon: '', label: 'إمكانية التصنيع النظرية', color: '#0E78AA', href: '/manufacturing/reports/theoretical-capability' },
      { key: 'cost-variance', icon: '', label: 'إنحراف تكاليف التصنيع', color: '#0E78AA', href: '/manufacturing/reports/cost-variance' },
      { key: 'invoice-variance', icon: '', label: 'إنحراف فواتير التصنيع', color: '#0E78AA', href: '/manufacturing/reports/invoice-variance' },
      { key: 'manufacturing-movements', icon: '', label: 'حركات التصنيع', color: '#0E78AA', href: '/manufacturing/reports/manufacturing-movements' },
      { key: 'order-status', icon: '', label: 'مواقف أوامر التصنيع', color: '#0E78AA', href: '/manufacturing/reports/order-status' },
      { key: 'sales-order-tracking', icon: '', label: 'متابعة أوامر البيع', color: '#0E78AA', href: '/manufacturing/reports/sales-order-tracking' },
      { key: 'work-order-tracking', icon: '', label: 'متابعة أوامر الشغل', color: '#0E78AA', href: '/manufacturing/reports/work-order-tracking' },
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
