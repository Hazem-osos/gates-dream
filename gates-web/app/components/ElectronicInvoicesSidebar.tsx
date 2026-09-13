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
    color: '#0E79AA',
    href: '/electronic-invoices'
  },
  {
    key: 'settings',
    icon: '',
    label: 'إعدادات الفواتير',
    color: '#0E79AA',
    href: '/electronic-invoices/settings'
  },
  {
    key: 'creations',
    icon: '',
    label: 'إنشاءات الفواتير',
    color: '#0E79AA',
    children: [
      { key: 'customer-card', icon: '', label: 'بطاقة عميل', color: '#0E79AA', href: '/electronic-invoices/creations/customer-card' },
      { key: 'item-card', icon: '', label: 'بطاقة صنف', color: '#0E79AA', href: '/electronic-invoices/creations/item-card' },
      { key: 'select-branch', icon: '', label: 'تحديد فرع', color: '#0E79AA', href: '/electronic-invoices/creations/branch-selection' },
      { key: 'send-invoice', icon: '', label: 'إرسال الفاتورة الإلكترونية', color: '#0E79AA', href: '/electronic-invoices/creations/send-invoice' },
      { key: 'send-returns', icon: '', label: 'إرسال المرتجعات الإلكترونية', color: '#0E79AA', href: '/electronic-invoices/creations/send-returns' },
      { key: 'send-amendments', icon: '', label: 'إرسال تعديلات الفواتير إلكترونياً', color: '#0E79AA', href: '/electronic-invoices/creations/send-amendments' }
    ]
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير الفواتير',
    color: '#0E79AA',
    children: [
      { key: 'sales-invoices', icon: '', label: 'فواتير المبيعات الإلكترونية', color: '#0E79AA', href: '/electronic-invoices/reports/sales-invoices' },
      { key: 'returns-invoices', icon: '', label: 'فواتير المرتجعات الإلكترونية', color: '#0E79AA', href: '/electronic-invoices/reports/returns-invoices' },
      { key: 'modified-returns', icon: '', label: 'فواتير المرتجعات الإلكترونية المعدلة ولم ترسل', color: '#0E79AA', href: '/electronic-invoices/reports/modified-returns' }
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
