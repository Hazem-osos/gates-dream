'use client';

import React, { ForwardedRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Eye, EyeOff, HelpCircle, Sparkles } from 'lucide-react';
import { NavbarQuickPanel } from './NavbarQuickPanel';
import { usePrivacyMode } from '@/lib/providers/PrivacyModeProvider';
import { useProductTourContext } from '@/components/onboarding/ProductTourProvider';
import { triggerScreenHelp } from '@/lib/ai/ask-screen-help';
import { resolveAiScreenContext } from '@/lib/ai/screen-context';
import { useI18n } from '@/lib/i18n';

type MenuItem = {
  icon: string;
  label: string;
  desc?: string;
  href: string;
};

const items: MenuItem[] = [
  { icon: '👤', label: 'الملف الشخصي', desc: 'البيانات والصلاحيات', href: '/profile' },
  { icon: '🔒', label: 'كلمة المرور والأمان', desc: 'تغيير كلمة المرور', href: '/profile' },
  { icon: '🏢', label: 'بيانات الشركة', desc: 'الاسم، الضريبة، الشعار', href: '/settings/company' },
  { icon: '📦', label: 'النسخ الاحتياطي', desc: 'تصدير بيانات الشركة', href: '/settings/backup' },
  { icon: '🖨', label: 'تخطيط المستندات', desc: 'قوالب الطباعة والهوية', href: '/settings/document-layout' },
  { icon: '📑', label: 'أنماط الإدخال', desc: 'ترقيم وثوابت وأعمدة الفواتير', href: '/settings/document-profiles' },
  { icon: '⚙️', label: 'الإعدادات المحاسبية', desc: 'إعدادات النظام المتقدمة', href: '/accounting-settings/company-settings/accounting-settings' },
];

export default function SettingsSidebar({
  onClose,
  panelRef,
}: {
  onClose: () => void;
  panelRef?: ForwardedRef<HTMLDivElement>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const { openAcademy } = useProductTourContext();

  const go = (path: string) => {
    onClose();
    if (path === '/logout') {
      window.location.assign(path);
      return;
    }
    router.push(path);
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
      <div className="grid grid-cols-3 gap-2 border-b border-[#E6F0F7] p-3">
        <button
          type="button"
          onClick={togglePrivacyMode}
          aria-pressed={privacyMode}
          title={privacyMode ? t('common.privacyOn') : t('common.privacyOff')}
          className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors ${
            privacyMode ? 'bg-[#E8F4FA] text-[#0E78AA]' : 'text-[#094C6B] hover:bg-[#F6FBFD]'
          }`}
        >
          {privacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          <span className="text-[11px] font-semibold leading-4">
            {privacyMode ? 'إظهار الأرقام' : 'إخفاء الأرقام'}
          </span>
        </button>
        <button
          type="button"
          data-screen-help
          onClick={() => {
            triggerScreenHelp(resolveAiScreenContext(pathname ?? '').pageTitle);
            onClose();
          }}
          title={t('common.screenHelp')}
          className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-[#094C6B] transition-colors hover:bg-[#F6FBFD]"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[11px] font-semibold leading-4">{t('common.screenHelp')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            openAcademy();
            onClose();
          }}
          title={t('nav.academy')}
          className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-[#094C6B] transition-colors hover:bg-[#F6FBFD]"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="text-[11px] font-semibold leading-4">المساعدة</span>
        </button>
      </div>
      <nav className="p-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => go(item.href)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right hover:bg-[#F6FBFD] transition-colors group"
          >
            <span className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-[#0E78AA] to-[#1787B8] flex items-center justify-center text-lg shadow-sm">
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-[#094C6B] group-hover:text-[#0E78AA]">
                {item.label}
              </span>
              {item.desc ? <span className="block text-xs text-gray-500 mt-0.5">{item.desc}</span> : null}
            </span>
            <span className="text-gray-300 group-hover:text-[#0E78AA] text-lg">‹</span>
          </button>
        ))}
      </nav>
    </NavbarQuickPanel>
  );
}
