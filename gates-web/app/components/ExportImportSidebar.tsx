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

export const exportImportModules: ModuleWithChildren[] = [
  {
    key: 'accreditations',
    icon: '',
    label: 'اعتمادات',
    color: '#9747FF',
    children: [
      { key: 'documentary-credit-definition', icon: '', label: 'تعريف الإعتماد المستندي', color: '#9747FF', href: '/importexport/accreditations/documentary-credit-definition' },
      { key: 'documentary-credit', icon: '', label: 'اعتماد المستندي', color: '#9747FF', href: '/importexport/accreditations/documentary-credit' },
      { key: 'guarantee-letter-settings', icon: '', label: 'إعدادات خطاب الضمان', color: '#9747FF', href: '/importexport/accreditations/letter-of-guarantee-settings' },
      { key: 'guarantee-letters', icon: '', label: 'خطابات الضمان', color: '#9747FF', href: '/importexport/accreditations/letters-of-guarantee' },
    ]
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير',
    color: '#9747FF',
    children: [
      { key: 'guarantee-letter-reports', icon: '', label: 'تقارير خطابات الضمان', color: '#9747FF', href: '/importexport/reports/guarantee-letters-reports' },
      { key: 'extended-guarantee-letter-reports', icon: '', label: 'تقارير خطابات الضمان الممتدة', color: '#9747FF', href: '/importexport/reports/extended-guarantee-letter-reports' },
    ]
  },
];


export default function ExportImportSidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="importexport"
      modules={exportImportModules as ModuleNavNode[]}
      collapsed={collapsed}
    />
  );
}
