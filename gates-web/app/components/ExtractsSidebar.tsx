'use client';
import { SubNavigationSidebar } from '@/app/components/navigation/SubNavigationSidebar';
import type { ModuleNavNode } from '@/lib/navigation/module-nav-types';

export const extractsModules: ModuleNavNode[] = [
  {
    key: 'dashboard',
    icon: '',
    label: 'لوحة المستخلصات',
    color: '#0E78AA',
    href: '/extracts',
  },
  {
    key: 'contracting-enterprise',
    icon: '',
    label: 'المقاولات (Enterprise)',
    color: '#0E78AA',
    children: [
      { key: 'contracting-dashboard', icon: '', label: 'لوحة المقاولات', color: '#0E78AA', href: '/contracting' },
      { key: 'contracting-tenders', icon: '', label: 'العطاءات', color: '#0E78AA', href: '/contracting/tenders' },
      { key: 'contracting-projects', icon: '', label: 'المشاريع', color: '#0E78AA', href: '/contracting/projects' },
      { key: 'subcontracts-home', icon: '', label: 'لوحة مقاولي الباطن', color: '#0E78AA', href: '/subcontracts' },
      { key: 'subcontracts-list', icon: '', label: 'سجل عقود الباطن', color: '#0E78AA', href: '/subcontracts/contracts' },
    ],
  },
  {
    key: 'operations',
    icon: '',
    label: 'عمليات (أرشيف / قديم)',
    color: '#0E78AA',
    children: [
      {
        key: 'contracting-legacy',
        icon: '',
        label: 'أرشيف ومستخلصات قديمة',
        color: '#0E78AA',
        children: [
          { key: 'contracting-extracts', icon: '', label: 'أرشيف Wave3 (ContractExtract)', color: '#0E78AA', href: '/contracting/extracts', badge: { text: 'أرشيف', tone: 'warning' } },
          { key: 'projects', icon: '', label: 'مشاريع المستخلصات (قديم)', color: '#0E78AA', href: '/extracts/operations/projects', badge: { text: 'قديم', tone: 'neutral' } },
        ],
      },
      { key: 'contractor', icon: '', label: 'تعريف المقاول', color: '#0E78AA', href: '/extracts/operations/contractor' },
      { key: 'settings', icon: '', label: 'إعدادات المستخلصات و المقاولات', color: '#0E78AA', href: '/extracts/operations/extract-contractor-settings' },
      { key: 'general-items', icon: '', label: 'البنود العامة للمستخلصات', color: '#0E78AA', href: '/extracts/operations/general-extract-items' },
      { key: 'detailed-items', icon: '', label: 'البنود التفصيلية للمستخلص', color: '#0E78AA', href: '/extracts/operations/detailed-extract-items' },
      { key: 'payments', icon: '', label: 'سداد المستخلص', color: '#0E78AA', href: '/extracts/operations/extract-payment' },
      { key: 'project-measurement', icon: '', label: 'تعريف مقايسة المشروع', color: '#0E78AA', href: '/extracts/operations/project-measurement-definition' },
      { key: 'manpower-log', icon: '', label: 'سجل العمالة', color: '#0E78AA', href: '/extracts/operations/manpower-log' },
    ],
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير',
    color: '#0E78AA',
    children: [
      { key: 'inventory', icon: '', label: 'تقرير الحصر', color: '#0E78AA', href: '/extracts/reports/inventory' },
      { key: 'projects-status', icon: '', label: 'تقرير موقف المشروعات نسب وكميات', color: '#0E78AA', href: '/extracts/reports/projects-status' },
      { key: 'contractor-payments', icon: '', label: 'تقرير مدفوعات المقاولين', color: '#0E78AA', href: '/extracts/reports/contractor-payments' },
      { key: 'tax-form-41', icon: '', label: 'نموذج 41 — خصم المنبع', color: '#0E78AA', href: '/subcontracts/reports/tax-form-41' },
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