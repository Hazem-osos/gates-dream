'use client';
import { SidebarUserCard } from '@/app/components/SidebarUserCard';
import { SidebarNavIcon } from '@/components/SidebarNavIcon';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSidebarDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';

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

export const salesModules: ModuleWithChildren[] = [
  {
    key: 'reports',
    icon: '',
    label: 'تقارير المبيعات',
    color: '#0E79AA',
    children: [
      { key: 'sales-reports', icon: '', label: 'تقارير المبيعات', color: '#0E79AA', href: '/inventory/reports/sales-reports' },
    ]
  }
];

export default function SalesSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const { profiles } = useSidebarDocumentProfiles();
  const modules = useMemo(() => {
    const salesProfiles = profiles.filter((p) => p.baseType === 'SALES_INVOICE');
    if (!salesProfiles.length) return salesModules;
    return [
      {
        key: 'operations',
        icon: '',
        label: 'المبيعات',
        color: '#0E79AA',
        children: salesProfiles.map((p) => ({
          key: `profile-${p.slug}`,
          icon: '',
          label: p.nameAr,
          color: '#0E79AA',
          href: `/sales/invoices/new?profile=${encodeURIComponent(p.slug)}`,
        })),
      },
      ...salesModules,
    ];
  }, [profiles]);

  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    setExpandedModules(parts);
  }, [pathname]);

  const hasChildren = (m: ModuleItem): m is ModuleWithChildren => 'children' in m;

  const getUrl = (m: ModuleItem, parent?: string) => m.href ?? `/${parent ? parent + '/' : ''}${m.key}`;

  const isActive = (m: ModuleItem, parent?: string): boolean => {
    const url = getUrl(m, parent);
    if (pathname === url) return true;
    if (hasChildren(m)) return m.children.some(c => isActive(c, m.key));
    return false;
  };

  const shouldExpand = (m: ModuleWithChildren) => expandedModules.includes(m.key) || m.children.some(c => isActive(c, m.key));

  if (collapsed) {
    return (
      <aside className="w-full h-full bg-[#F9FAFB] shadow-xl flex flex-col justify-between items-center py-4" style={{ direction: 'rtl' }}>
        <SidebarUserCard variant="collapsed" />
        <nav className="flex flex-col items-center gap-8 mt-8">
          {modules.map((m) => (
            <a key={m.key} href={getUrl(m)} className={`flex items-center justify-center w-10 h-10 ${isActive(m) ? 'bg-[#E6F0F7] rounded-md' : ''}`}>
              <span className="w-7 h-7 bg-[#E6F0F7] rounded-md flex items-center justify-center text-[#0E79AA] text-lg">📊</span>
            </a>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-6 mb-4">
          <button className="w-10 h-10 flex items-center justify-center"><span className="w-7 h-7 bg-[#E6F0F7] rounded-md flex items-center justify-center text-[#0E79AA] text-lg">⎋</span></button>
          <div className="relative w-10 h-5 flex items-center bg-gray-200 rounded-full p-1">
            <div className="absolute left-1 top-1 w-3.5 h-3.5 bg-white rounded-full shadow"><span className="text-[#0E79AA] text-sm">🌙</span></div>
            <span className="absolute right-1 top-1 text-yellow-400 text-sm">☀️</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full min-w-0 max-w-full h-full bg-white rounded-2xl flex flex-col justify-between border border-[#E6F0F7] shadow-none" style={{ direction: 'rtl' }}>
      <div className="flex flex-col items-center pt-6 pb-2 px-0">
        <SidebarUserCard variant="expanded" />
      </div>
      <nav className="flex-1 overflow-y-auto px-0 pt-2 pb-2">
        {modules.map((m) => (
          <div key={m.key} className="mb-1">
            <a
              href={getUrl(m)}
              className={`flex items-center text-lg font-bold rounded-lg mx-3 px-3 py-2 transition-all duration-200 group ${isActive(m) ? 'bg-[#DEEFF6] text-[#094C6B] font-bold' : 'text-[#094C6B] hover:bg-[#DEEFF6] hover:text-[#094C6B]'}`}
              onClick={(e) => {
                if (hasChildren(m)) {
                  e.preventDefault();
                  setExpandedModules(prev => prev.includes(m.key) ? prev.filter(k => k !== m.key) : [...prev, m.key]);
                }
              }}
            >
              <SidebarNavIcon src="/tabler_report.svg" alt="" className="w-5 h-5 ml-2" />
              <span className="flex-1 text-right">{m.label}</span>
              {'children' in m && (
                <SidebarNavIcon
                  src="/bxs_up-arrow.svg"
                  alt=""
                  width={12}
                  height={12}
                  className={`transition-transform duration-200 w-3 h-3 ml-2 ${expandedModules.includes(m.key) ? 'rotate-180' : ''}`}
                />
              )}
            </a>
            {'children' in m && shouldExpand(m) && (
              <div className="mt-1 mr-6 space-y-1">
                {m.children.map((c) => (
                  <a key={c.key} href={getUrl(c, m.key)} className={`flex items-center text-sm font-normal rounded-lg px-3 py-2 transition-all duration-200 group ${isActive(c, m.key) ? 'bg-[#DEEFF6] text-[#094C6B] font-bold' : 'text-[#094C6B] hover:bg-[#DEEFF6] hover:text-[#094C6B]'}`}>
                    <SidebarNavIcon
                      src="/akar-icons_arrow-back.svg"
                      alt=""
                      width={16}
                      height={16}
                      className="transition-transform duration-200 w-4 h-4 ml-2"
                    />
                    <span className="flex-1 text-right">{c.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-2 items-center py-4 border-t border-[#E6F0F7] bg-white rounded-b-2xl">
        <button className="flex items-center gap-2 text-sm font-medium text-[#094C6B] hover:bg-[#DEEFF6] rounded-lg px-3 py-2 transition-all duration-200"><span className="w-6 h-6 flex items-center justify-center text-lg">⎋</span>تسجيل الخروج</button>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative w-10 h-5 flex items-center bg-[#DEEFF6] rounded-full p-1">
            <div className="absolute right-1 top-1 w-3.5 h-3.5 bg-white rounded-full shadow flex items-center justify-center"><span className="text-[#094C6B] text-sm">🌙</span></div>
            <span className="absolute left-1 top-1 text-yellow-400 text-sm">☀️</span>
          </div>
          <span className="text-sm font-normal text-[#094C6B]">وضع الإضاءة</span>
        </div>
        <div className="mt-2 text-center">
          <div className="font-semibold text-xs text-[#094C6B]">Gate Soft ERP System</div>
          <div className="text-xs text-gray-400">© 2025 All Rights Reserved</div>
        </div>
      </div>
    </aside>
  );
}
