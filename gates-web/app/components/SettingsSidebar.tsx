import React, { ForwardedRef } from 'react';
import { useRouter } from 'next/navigation';
import { NavbarQuickPanel } from './NavbarQuickPanel';

type MenuItem = {
  icon: string;
  label: string;
  desc?: string;
  href: string;
};

const items: MenuItem[] = [
  { icon: '👤', label: 'الملف الشخصي', desc: 'البيانات والصلاحيات', href: '/profile' },
  { icon: '🔒', label: 'كلمة المرور والأمان', desc: 'تغيير كلمة المرور', href: '/profile' },
  { icon: '🏢', label: 'بيانات الشركة', desc: 'الضريبة، ETA، الشعار', href: '/settings/company' },
  { icon: '📦', label: 'النسخ الاحتياطي', desc: 'تصدير بيانات الشركة', href: '/settings/backup' },
  { icon: '🖨', label: 'تخطيط المستندات', desc: 'قوالب الطباعة والهوية', href: '/settings/document-layout' },
  { icon: '📑', label: 'أنماط الإدخال', desc: 'ترقيم وثوابت وأعمدة الفواتير', href: '/settings/document-profiles' },
  { icon: '⚙️', label: 'الإعدادات المحاسبية', desc: 'إعدادات النظام المتقدمة', href: '/accounting-settings/company-data' },
];

export default function SettingsSidebar({
  onClose,
  panelRef,
}: {
  onClose: () => void;
  panelRef?: ForwardedRef<HTMLDivElement>;
}) {
  const router = useRouter();

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <NavbarQuickPanel
      title="الإعدادات السريعة"
      subtitle="الحساب والشركة"
      onClose={onClose}
      panelRef={panelRef}
      footer={
        <button
          type="button"
          onClick={() => go('/logout')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
        >
          <span aria-hidden>⎋</span>
          تسجيل الخروج
        </button>
      }
    >
      <nav className="p-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => go(item.href)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right hover:bg-[#F6FBFD] transition-colors group"
          >
            <span className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-[#0E79AA] to-[#1787B8] flex items-center justify-center text-lg shadow-sm">
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-[#094C6B] group-hover:text-[#0E79AA]">
                {item.label}
              </span>
              {item.desc ? <span className="block text-xs text-gray-500 mt-0.5">{item.desc}</span> : null}
            </span>
            <span className="text-gray-300 group-hover:text-[#0E79AA] text-lg">‹</span>
          </button>
        ))}
      </nav>
    </NavbarQuickPanel>
  );
}
