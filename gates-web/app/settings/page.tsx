'use client';

import Link from 'next/link';

const links = [
  { href: '/settings/company', label: 'بيانات الشركة' },
  { href: '/accounting-settings', label: 'الإعدادات المالية' },
  { href: '/hr/settings', label: 'إعدادات شؤون الموظفين' },
  { href: '/settings/document-layout', label: 'تنسيق المستندات' },
  { href: '/settings/document-profiles', label: 'ملفات المستندات' },
  { href: '/settings/backup', label: 'النسخ الاحتياطي' },
];

export default function SettingsHubPage() {
  return (
    <div className="min-h-screen p-6" dir="rtl">
      <h1 className="mb-2 text-xl font-bold text-[#0E78AA]">الإعدادات</h1>
      <p className="mb-6 text-sm text-[#094C6B]">كل إعدادات الشركة والحسابات والمستندات من هنا.</p>
      <ul className="grid max-w-xl gap-3">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-xl border border-[#D6EAF3] bg-white px-4 py-3 text-sm font-semibold text-[#094C6B] hover:border-[#0E78AA]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
