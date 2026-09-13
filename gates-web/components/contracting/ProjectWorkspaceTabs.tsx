'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { BarChart3, FileSpreadsheet, Landmark, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: 'technical-office', label: 'المكتب الفني', icon: Ruler },
  { href: 'client-billing', label: 'مستخلصات المالك', icon: FileSpreadsheet },
  { href: 'letters-of-guarantee', label: 'خطابات الضمان', icon: Landmark },
  { href: 'cost-control', label: 'مراقبة التكاليف', icon: BarChart3 },
] as const;

export function ProjectWorkspaceTabs() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = params.id;

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-[#D6EAF3] bg-white p-2 shadow-sm" dir="rtl">
      {TABS.map((tab) => {
        const href = `/contracting/projects/${id}/${tab.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors',
              active
                ? 'bg-gradient-to-l from-[#0E79AA] to-[#3EC6E0] text-white shadow'
                : 'text-[#094C6B] hover:bg-[#F6FBFD]'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
