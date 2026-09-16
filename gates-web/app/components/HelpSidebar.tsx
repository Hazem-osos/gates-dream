import React, { ForwardedRef } from 'react';
import { useRouter } from 'next/navigation';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { NavbarQuickPanel } from './NavbarQuickPanel';

const helpItems: Array<{
  icon: string;
  title: string;
  desc: string;
  href: string;
  external?: boolean;
}> = [
  {
    icon: '📘',
    title: 'مركز المساعدة',
    desc: 'دليل الدورة المحاسبية واختصارات لوحة المفاتيح',
    href: '/help',
  },
  {
    icon: '🛒',
    title: 'دورة المبيعات',
    desc: 'صنف → فاتورة → تحصيل → قائمة الدخل',
    href: '/help',
  },
  {
    icon: '🎧',
    title: 'الدعم الفني',
    desc: 'support@gates-soft.com',
    href: 'mailto:support@gates-soft.com',
    external: true,
  },
];

export default function HelpSidebar({
  onClose,
  panelRef,
}: {
  onClose: () => void;
  panelRef?: ForwardedRef<HTMLDivElement>;
}) {
  const router = useRouter();

  const open = (href: string, external?: boolean) => {
    if (external) {
      window.location.href = href;
    } else {
      router.push(destinationAppTabHref(href));
    }
    onClose();
  };

  return (
    <NavbarQuickPanel
      title="المساعدة والدعم"
      subtitle="إرشادات سريعة"
      onClose={onClose}
      panelRef={panelRef}
      footer={
        <button
          type="button"
          onClick={() => open('/help')}
          className="w-full rounded-xl bg-[#0E79AA] py-2.5 text-sm font-bold text-white hover:bg-[#095a80] transition-colors"
        >
          فتح مركز المساعدة الكامل
        </button>
      }
    >
      <ul className="p-2 space-y-1">
        {helpItems.map((item) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() => open(item.href, item.external)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-right hover:bg-[#F6FBFD] transition-colors"
            >
              <span className="w-10 h-10 shrink-0 rounded-lg bg-[#DEEFF6] flex items-center justify-center text-xl">
                {item.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-[#094C6B]">{item.title}</span>
                <span className="block text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </NavbarQuickPanel>
  );
}
