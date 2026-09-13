'use client';
import { SubNavigationSidebar } from '@/app/components/navigation/SubNavigationSidebar';
import type { ModuleNavNode } from '@/lib/navigation/module-nav-types';

export const extractsModules: ModuleNavNode[] = [
  {
    key: 'dashboard',
    icon: '',
    label: 'لوحة المستخلصات',
    color: '#0E79AA',
    href: '/extracts',
  },
  {
    key: 'operations',
    icon: '',
    label: 'عمليات',
    color: '#0E79AA',
    children: [
      { key: 'projects', icon: '', label: 'إدارة المشاريع', color: '#0E79AA', href: '/extracts/operations/projects'  },
      { key: 'contracting-dashboard', icon: '', label: 'لوحة المقاولات', color: '#0E79AA', href: '/contracting' },
      { key: 'contracting-workspace', icon: '', label: 'مكتب فني ومالك وضمانات', color: '#0E79AA', href: '/contracting/projects' },
      { key: 'settings', icon: '', label: 'إعدادات المستخلصات و المقاولات', color: '#0E79AA', href: '/extracts/operations/extract-contractor-settings' },
      { key: 'general-items', icon: '', label: 'البنود العامة للمستخلصات', color: '#0E79AA', href: '/extracts/operations/general-extract-items' },
      { key: 'detailed-items', icon: '', label: 'البنود التفصيلية للمستخلص', color: '#0E79AA', href: '/extracts/operations/detailed-extract-items' },
      { key: 'payments', icon: '', label: 'سداد المستخلص', color: '#0E79AA', href: '/extracts/operations/extract-payment' },
      { key: 'project-measurement', icon: '', label: 'تعريف مقايسة المشروع', color: '#0E79AA', href: '/extracts/operations/project-measurement-definition' },
      { key: 'manpower-log', icon: '', label: 'سجل العمالة', color: '#0E79AA', href: '/extracts/operations/manpower-log' },
      { key: 'subcontracts', icon: '', label: 'لوحة مقاولي الباطن', color: '#0E79AA', href: '/subcontracts' },
      { key: 'subcontracts-list', icon: '', label: 'سجل عقود الباطن', color: '#0E79AA', href: '/subcontracts/contracts' },
    ]
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير',
    color: '#0E79AA',
    children: [
      { key: 'inventory', icon: '', label: 'تقرير الحصر', color: '#0E79AA', href: '/extracts/reports/inventory' },
      { key: 'projects-status', icon: '', label: 'تقرير موقف المشروعات نسب وكميات', color: '#0E79AA', href: '/extracts/reports/projects-status' },
      { key: 'contractor-payments', icon: '', label: 'تقرير مدفوعات المقاولين', color: '#0E79AA', href: '/extracts/reports/contractor-payments' },
      { key: 'tax-form-41', icon: '', label: 'نموذج 41 — خصم المنبع', color: '#0E79AA', href: '/subcontracts/reports/tax-form-41' },
    ]
  },
];

export default function ExtractsSidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="statements"
      modules={extractsModules}
      collapsed={collapsed}
    />
  );
}