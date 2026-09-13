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

export const estsmar3akaryModules: ModuleWithChildren[] = [
  {
    key: 'create',
    icon: '',
    label: 'إنشاءات',
    color: '#0E79AA',
    children: [
      { key: 'investment-settings', icon: '⚙️', label: 'إعدادات الإستثمار العقاري', color: '#0E79AA', href: '/real-estate-investment/create/settings' },
      { key: 'unit-sale-others', icon: '🏢', label: 'تعريف وحدة للبيع للغير', color: '#0E79AA', href: '/real-estate-investment/create/unit-sale-others'  },
      { key: 'unit-sale-private', icon: '🏠', label: 'تعريف وحدة للبيع خاصة', color: '#0E79AA', href: '/real-estate-investment/create/unit-sale-private' },
      { key: 'sales-employees', icon: '👥', label: 'تعريف موظفي المبيعات', color: '#0E79AA', href: '/real-estate-investment/create/sales-employees' },
      { key: 'marketing-channels', icon: '📢', label: 'تعريف قنوات التسويق', color: '#0E79AA', href: '/real-estate-investment/create/marketing-channels' },
      { key: 'customers', icon: '👤', label: 'تعريف العملاء', color: '#0E79AA', href: '/real-estate-investment/create/customers' },
    ]
  },
  {
    key: 'operations',
    icon: '⤢',
    label: 'عمليات',
    color: '#0E79AA',
    children: [
      { key: 're-investment-dashboard', icon: '', label: 'لوحة الاستثمار العقاري', color: '#0E79AA', href: '/real-estate-investment' },
      { key: 're-dashboard', icon: '', label: 'لوحة التطوير العقاري', color: '#0E79AA', href: '/real-estate' },
      { key: 're-contracts', icon: '', label: 'عقود الوحدات والأقساط', color: '#0E79AA', href: '/real-estate/contracts' },
      { key: 're-cheques', icon: '', label: 'محفظة الشيكات الآجلة', color: '#0E79AA', href: '/real-estate/cheques' },
      { key: 're-resale', icon: '', label: 'إعادة البيع والتنازل', color: '#0E79AA', href: '/real-estate/resale' },
      { key: 're-rental-pools', icon: '', label: 'توزيع إيجار المجمع', color: '#0E79AA', href: '/real-estate/rental-pools' },
      { key: 'reservation', icon: '', label: 'الحجز', color: '#0E79AA', href: '/real-estate-investment/operations/reservation' },
      { key: 'closure', icon: '', label: 'الإقفال', color: '#0E79AA', href: '/real-estate-investment/operations/closure' },
    ]
  },
  {
    key: 'reports',
    icon: '📋',
    label: 'تقارير',
    color: '#0E79AA',
    children: [
      { key: 'customer-followup', icon: '📊', label: 'تقارير عملاء تحت المتابعة', color: '#0E79AA', href: '/real-estate-investment/reports/customer-tracking' },
      { key: 'customer', icon: '📊', label: 'تقارير عملاء  ', color: '#0E79AA', href: '/real-estate-investment/reports/customer' },
      { key: 'customer-tracking', icon: '📈', label: 'تقارير متابعة العملاء', color: '#0E79AA', href: '/real-estate-investment/reports/customer-followup' },
      { key: 'unit-customer-matching', icon: '🔗', label: 'تقارير مطابقة الوحدات مع العملاء', color: '#0E79AA', href: '/real-estate-investment/reports/unit-customer-matching' },
      { key: 'unit-preview', icon: '👁️', label: 'تقارير معاينة الوحدات', color: '#0E79AA', href: '/real-estate-investment/reports/unit-preview' },
      { key: 'customer-area-matching', icon: '📏', label: 'تقارير العملاء بالمطابقة بالمساحات', color: '#0E79AA', href: '/real-estate-investment/reports/customer-area-matching' },
    ]
  },
];


export default function SidebarEstsmar3akary({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="realestate"
      modules={estsmar3akaryModules as ModuleNavNode[]}
      collapsed={collapsed}
    />
  );
}
