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

const COLOR = '#0E79AA';

export const fixedAssetsModules: ModuleWithChildren[] = [
  {
    key: 'fa-master',
    icon: '',
    label: 'البيانات الأساسية',
    color: COLOR,
    children: [
      { key: 'fa-categories', icon: '', label: 'فئات الأصول', color: COLOR, href: '/fixed-assets/categories' },
      { key: 'fa-register', icon: '', label: 'سجل الأصول', color: COLOR, href: '/fixed-assets/assets' },
      { key: 'fa-new', icon: '', label: 'إضافة أصل', color: COLOR, href: '/fixed-assets/assets/new' },
    ],
  },
  {
    key: 'fa-operations',
    icon: '',
    label: 'العمليات',
    color: COLOR,
    children: [
      { key: 'fa-depreciation', icon: '', label: 'الإهلاك الشهري', color: COLOR, href: '/fixed-assets/depreciation' },
      { key: 'fa-disposals', icon: '', label: 'بيع واستبعاد الأصول', color: COLOR, href: '/fixed-assets/disposals' },
    ],
  },
  {
    key: 'fa-reports',
    icon: '',
    label: 'التقارير',
    color: COLOR,
    children: [
      { key: 'fa-movement', icon: '', label: 'تقرير حركة الأصول', color: COLOR, href: '/fixed-assets/reports/movement' },
    ],
  },
];

export default function FixedAssetsSidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="fixedassets"
      modules={fixedAssetsModules as ModuleNavNode[]}
      collapsed={collapsed}
    />
  );
}
