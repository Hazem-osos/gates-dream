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

export const electronicInvoicesModules: (ModuleItem | ModuleWithChildren)[] = [
  {
    key: 'dashboard',
    icon: '',
    label: 'لوحة الفواتير الإلكترونية',
    color: '#0E78AA',
    href: '/electronic-invoices'
  },
  {
    key: 'settings',
    icon: '',
    label: 'إعدادات الفواتير',
    color: '#0E78AA',
    href: '/electronic-invoices/settings'
  },
  {
    key: 'creations',
    icon: '',
    label: 'إنشاءات الفواتير',
    color: '#0E78AA',
    children: [
      { key: 'send-invoice', icon: '', label: 'إرسال الفاتورة الإلكترونية', color: '#0E78AA', href: '/electronic-invoices/creations/send-invoice' },
    ]
  },
  {
    key: 'receipts',
    icon: '',
    label: 'الإيصالات الإلكترونية',
    color: '#0E78AA',
    href: '/electronic-invoices/receipts'
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير الفواتير',
    color: '#0E78AA',
    children: [
      { key: 'sales-invoices', icon: '', label: 'تقرير الفواتير الإلكترونية', color: '#0E78AA', href: '/electronic-invoices/reports/sales-invoices' },
      { key: 'returns-invoices', icon: '', label: 'الإشعارات الدائنة', color: '#0E78AA', href: '/electronic-invoices/reports/returns-invoices' },
      { key: 'modified-returns', icon: '', label: 'الإشعارات المدينة', color: '#0E78AA', href: '/electronic-invoices/reports/modified-returns' }
    ]
  },
];


export default function ElectronicInvoicesSidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="electronic-invoices"
      modules={electronicInvoicesModules as ModuleNavNode[]}
      collapsed={collapsed}
    />
  );
}
