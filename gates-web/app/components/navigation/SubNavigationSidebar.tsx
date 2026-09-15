'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Home, Settings } from 'lucide-react';
import { settingsHrefForNav, sourceHrefForSettingsPath } from '@/lib/transaction-settings/types';
import { SidebarUserCard } from '@/app/components/SidebarUserCard';
import { PrefetchNavLink } from '@/components/navigation/PrefetchNavLink';
import { ModuleNavSearch } from '@/app/components/navigation/ModuleNavSearch';
import { buildCategorizedNavGroups } from '@/lib/navigation/categorize-module-nav';
import { filterModuleNavLinks, flattenModuleNavLinks } from '@/lib/navigation/flatten-module-nav';
import {
  readNavGroupOpenState,
  writeNavGroupOpenState,
  type NavGroupOpenState,
} from '@/lib/navigation/module-nav-group-storage';
import { resolveModuleSidebarMeta } from '@/lib/navigation/module-sidebar-meta';
import type {
  CategorizedNavGroup,
  FlatModuleNavLink,
  ModuleNavBadge,
  ModuleNavNode,
  NavCategoryId,
} from '@/lib/navigation/module-nav-types';
import { cn } from '@/lib/utils';

export type SubNavigationSidebarProps = {
  moduleKey: string;
  modules: ModuleNavNode[];
  collapsed?: boolean;
  onLogout?: () => void;
};

function badgeClasses(badge: ModuleNavBadge): string {
  switch (badge.tone) {
    case 'warning':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200';
    case 'success':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200';
    case 'info':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}

function NavLinkRow({ link, active }: { link: FlatModuleNavLink; active: boolean }) {
  const settingsHref = settingsHrefForNav(link.href);
  return (
    <div className="group relative">
      <PrefetchNavLink
        href={link.href}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-[13px] transition-all',
          active
            ? 'rounded-xl bg-[#0E78AA] font-semibold text-white shadow-sm'
            : 'rounded-xl text-slate-600 hover:bg-white hover:text-[#0E78AA] dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
        )}
      >
        <span className="flex-1 text-right leading-snug">{link.label}</span>
        {link.badge ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              badgeClasses(link.badge)
            )}
          >
            {link.badge.text}
          </span>
        ) : null}
      </PrefetchNavLink>
      {settingsHref ? (
        <PrefetchNavLink
          href={settingsHref}
          aria-label="إعدادات الفاتورة"
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:text-[#0E79AA] group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          data-tour="settings-gear"
        >
          <Settings className="h-3.5 w-3.5" />
        </PrefetchNavLink>
      ) : null}
    </div>
  );
}

export function SubNavigationSidebar({
  moduleKey,
  modules,
  collapsed = false,
  onLogout,
}: SubNavigationSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const meta = resolveModuleSidebarMeta(moduleKey);
  const groups = useMemo(() => buildCategorizedNavGroups(modules), [modules]);
  const allLinks = useMemo(() => flattenModuleNavLinks(modules), [modules]);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<NavGroupOpenState>(() => ({
    operations: true,
    master: true,
    reports: false,
    settings: false,
  }));
  const [openSubgroups, setOpenSubgroups] = useState<Record<string, boolean>>({});

  const filteredLinks = useMemo(
    () => filterModuleNavLinks(allLinks, search),
    [allLinks, search]
  );

  const filteredGroupIds = useMemo(() => {
    const ids = new Set<NavCategoryId>();
    for (const link of filteredLinks) ids.add(link.category);
    return ids;
  }, [filteredLinks]);

  useEffect(() => {
    const saved = readNavGroupOpenState(moduleKey);
    setOpenGroups((prev) => ({ ...prev, ...saved }));
  }, [moduleKey]);

  useEffect(() => {
    if (!pathname) return;
    const settingsSourceHref = sourceHrefForSettingsPath(pathname);
    const matches = (href: string) =>
      pathname === href || pathname.startsWith(`${href}/`) || settingsSourceHref === href;
    const activeGroup = groups.find(
      (g) =>
        g.items.some((item) => matches(item.href)) ||
        g.subgroups.some((sg) => sg.items.some((item) => matches(item.href)))
    );
    const activeSubgroup = activeGroup?.subgroups.find((sg) => sg.items.some((item) => matches(item.href)));
    if (activeSubgroup) {
      setOpenSubgroups((prev) => ({ ...prev, [activeSubgroup.id]: true }));
    }
    if (activeGroup) {
      setOpenGroups((prev) => {
        const next = { ...prev, [activeGroup.id]: true };
        writeNavGroupOpenState(moduleKey, next);
        return next;
      });
    }
  }, [pathname, groups, moduleKey]);

  useEffect(() => {
    if (!search.trim()) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const id of filteredGroupIds) next[id] = true;
      return next;
    });
  }, [search, filteredGroupIds]);

  const toggleGroup = useCallback(
    (id: NavCategoryId) => {
      setOpenGroups((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        writeNavGroupOpenState(moduleKey, next);
        return next;
      });
    },
    [moduleKey]
  );

  const settingsSourceHref = sourceHrefForSettingsPath(pathname);
  const isLinkActive = (href: string) =>
    pathname === href ||
    settingsSourceHref === href ||
    (href !== '/' && Boolean(pathname?.startsWith(`${href}/`)));

  const renderSearchResults = () => {
    if (!search.trim()) return null;
    if (filteredLinks.length === 0) {
      return (
        <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          لا توجد شاشات مطابقة
        </p>
      );
    }
    return (
      <ul className="space-y-1">
        {filteredLinks.map((link) => (
          <li key={`${link.href}-${link.key}`}>
            <NavLinkRow link={link} active={isLinkActive(link.href)} />
          </li>
        ))}
      </ul>
    );
  };

  const renderGroups = (items: CategorizedNavGroup[]) =>
    items.map((group) => {
      const isOpen = search.trim() ? true : !!openGroups[group.id];
      const visibleItems = search.trim()
        ? group.items.filter((i) => filteredLinks.some((f) => f.href === i.href))
        : group.items;
      const visibleSubgroups = group.subgroups
        .map((sg) => ({
          ...sg,
          items: search.trim()
            ? sg.items.filter((i) => filteredLinks.some((f) => f.href === i.href))
            : sg.items,
        }))
        .filter((sg) => sg.items.length > 0);
      const totalCount = visibleItems.length + visibleSubgroups.reduce((n, sg) => n + sg.items.length, 0);
      if (search.trim() && totalCount === 0) return null;

      return (
        <div
          key={group.id}
          className="overflow-hidden rounded-2xl border border-[#D6EAF3] bg-gradient-to-b from-[#F7FBFD] to-white p-2 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900"
        >
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-right text-xs font-bold text-[#094C6B] hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800/40"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-[#0E78AA] transition-transform duration-200',
                isOpen ? 'rotate-180' : 'rotate-0'
              )}
            />
            <span className="flex-1">{group.title}</span>
            <span className="rounded-full bg-[#E8F4FA] px-2 py-0.5 text-[10px] font-semibold text-[#0E78AA] dark:bg-slate-800 dark:text-slate-400">
              {totalCount}
            </span>
          </button>
          {isOpen ? (
            <div className="mt-1 space-y-2">
              {visibleSubgroups.map((sg) => {
                const sgOpen = search.trim() ? true : openSubgroups[sg.id] !== false;
                return (
                  <div key={sg.id} className="rounded-xl bg-white/80 px-1 py-1 dark:bg-slate-800/40">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSubgroups((prev) => ({ ...prev, [sg.id]: !(prev[sg.id] !== false) }))
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right"
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-[#0E78AA] transition-transform',
                          sgOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                      <span className="flex-1 text-[11px] font-bold tracking-wide text-[#0E78AA]">
                        {sg.title}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">{sg.items.length}</span>
                    </button>
                    {sgOpen ? (
                      <ul className="mt-0.5 space-y-0.5">
                        {sg.items.map((link) => (
                          <li key={`${sg.id}-${link.href}`}>
                            <NavLinkRow link={link} active={isLinkActive(link.href)} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
              {visibleItems.length ? (
                <ul className="space-y-0.5">
                  {visibleItems.map((link) => (
                    <li key={`${group.id}-${link.href}`}>
                      <NavLinkRow link={link} active={isLinkActive(link.href)} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    });

  if (collapsed) {
    const topLinks = allLinks.slice(0, 6);
    return (
      <aside
        data-tour="module-sidebar"
        className="flex h-full w-16 flex-col items-center justify-between bg-[#F9FAFB] py-4 dark:bg-slate-900"
        style={{ direction: 'rtl' }}
      >
        <SidebarUserCard variant="collapsed" />
        <nav className="mt-4 flex flex-col items-center gap-3">
          {topLinks.map((link) => (
            <PrefetchNavLink
              key={link.href}
              href={link.href}
              title={link.label}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl text-lg',
                isLinkActive(link.href)
                  ? cn(meta.theme.accentBg, meta.theme.accentText)
                  : 'bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {meta.emoji}
            </PrefetchNavLink>
          ))}
        </nav>
        <div className="mb-2">
          <button
            type="button"
            title="الرئيسية"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm dark:bg-slate-800"
            onClick={() => router.push('/dashboard')}
          >
            <Home className="h-5 w-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      data-tour="module-sidebar"
      className={cn(
        'flex h-[calc(100vh-0px)] w-full min-w-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      )}
      style={{ direction: 'rtl' }}
    >
      <div className="shrink-0 space-y-3 border-b border-[#D6EAF3] bg-gradient-to-l from-[#E8F4FA] to-white px-3 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-sm',
              meta.theme.iconBg,
              meta.theme.iconText
            )}
          >
            {meta.emoji}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-sm font-bold text-[#094C6B] dark:text-white">{meta.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{meta.subtitle}</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Home className="h-3.5 w-3.5" />
          الرئيسية
        </Link>
        <ModuleNavSearch value={search} onChange={setSearch} />
        <SidebarUserCard variant="expanded" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
        <nav className="space-y-3">
          {search.trim() ? renderSearchResults() : renderGroups(groups)}
        </nav>
      </div>

      <div className="shrink-0 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
        {onLogout ? (
          <button
            type="button"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onLogout}
          >
            تسجيل الخروج
          </button>
        ) : null}
        <p className="text-center text-[10px] text-slate-400">Gate Soft ERP · © 2025</p>
      </div>
    </aside>
  );
}
