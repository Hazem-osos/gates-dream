'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { BarChart3, FileSpreadsheet, Landmark, LayoutDashboard, Ruler, ScrollText, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: 'technical-office', label: 'جدول الكميات', icon: Ruler },
  { href: 'client-billing', label: 'مستخلصات المالك', icon: FileSpreadsheet },
  { href: 'preliminary-certificates', label: 'مستخلصات ابتدائية', icon: ScrollText },
  { href: 'variation-orders', label: 'أوامر التغيير', icon: ScrollText },
  { href: 'actual-cost', label: 'التكلفة الفعلية', icon: TrendingUp },
  { href: 'profitability', label: 'مراقبة وربحية المشروع', icon: BarChart3 },
  { href: 'execution-plan', label: 'مخطط التنفيذ', icon: Ruler },
  { href: 'performance', label: 'أداء المشروع', icon: BarChart3 },
  { href: 'letters-of-guarantee', label: 'خطابات الضمان', icon: Landmark },
  { href: 'cost-control', label: 'EVM (أرشيف)', icon: BarChart3, legacy: true },
] as const;

export function ProjectWorkspaceTabs() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = params.id;

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface-1 p-2 shadow-sm">
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
                ? 'bg-brand text-white shadow'
                : 'text-brand hover:bg-[var(--info-soft)]',
              'legacy' in tab && tab.legacy && !active && 'opacity-80'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
