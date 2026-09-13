'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageFavorites } from '@/lib/hooks/usePageFavorites';

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  description?: string;
  className?: string;
  favoriteHref?: string;
  favoriteLabel?: string;
  statusBadge?: React.ReactNode;
}

export function PageHeader({
  title,
  breadcrumbs,
  actions,
  description,
  className,
  favoriteHref,
  favoriteLabel,
  statusBadge,
}: PageHeaderProps) {
  const pathname = usePathname();
  const favHref = favoriteHref ?? pathname ?? '';
  const favLabel = favoriteLabel ?? title;
  const { isFavorite, toggleFavorite } = usePageFavorites();
  const starred = favHref ? isFavorite(favHref) : false;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 mb-4 w-full border-b border-[#E6F0F7] bg-white/95 py-2.5 backdrop-blur-md',
        className
      )}
      dir="rtl"
    >
      <div className="flex w-full items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav className="mb-2 flex flex-wrap items-center justify-start gap-1 text-sm text-slate-600">
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
                  {i > 0 ? <ChevronLeft className="h-3.5 w-3.5 rotate-180 opacity-50" /> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-[#0E78AA]">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-800">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}

          <div className="flex flex-wrap items-center justify-start gap-2">
            {favHref ? (
              <button
                type="button"
                title={starred ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                onClick={() => toggleFavorite(favHref, favLabel)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <Star
                  className={cn(
                    'h-5 w-5',
                    starred ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
                  )}
                />
              </button>
            ) : null}
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
            {statusBadge}
          </div>

          {description ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 text-start max-w-3xl">
              {description}
            </p>
          ) : null}
          <div className="mt-3 h-1 w-full max-w-md rounded-full bg-[#0E78AA] shadow-sm" />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
          <div data-gates-page-header-actions className="contents" />
        </div>
      </div>
    </header>
  );
}
