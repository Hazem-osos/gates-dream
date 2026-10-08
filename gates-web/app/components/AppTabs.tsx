"use client";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IoClose } from "react-icons/io5";
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';
import { useAppTabs } from './AppTabsContext';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import { probeCount, probeNavUrl } from '@/lib/debug/gates-crash-probe';

export default function AppTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const ctx = useAppTabs();
  const tabs = ctx?.tabs ?? [];
  const activeTab = pathname ? normalizeAppPath(pathname) : '';
  const justOpenedPath = ctx?.justOpenedPath ?? null;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [activeTab, tabs.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [menuOpen]);

  const goTo = (dest: string) => {
    probeCount('router.push');
    probeNavUrl(`${window.location.pathname}${window.location.search}`, dest);
    router.push(dest);
  };

  const activateTab = (path: string, href?: string) => {
    const dest = href || ctx?.hrefForTab(path) || path || '/';
    if (path !== activeTab) {
      flushPageDrafts();
      ctx?.pinCurrentTab();
    }
    goTo(dest);
  };

  const closeTab = (path: string, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const remaining = tabs.filter((tab) => tab.path !== path);
    ctx?.closeTab(path);
    if (path === activeTab) {
      if (remaining.length > 0) {
        const last = remaining[remaining.length - 1];
        activateTab(last.path, last.href);
      } else {
        const currentRoot = pathname.split('/')[1];
        activateTab(currentRoot ? `/${currentRoot}` : '/');
      }
    }
  };

  const closeOthers = () => {
    tabs.forEach((tab) => {
      if (tab.path !== activeTab) ctx?.closeTab(tab.path);
    });
    setMenuOpen(false);
  };

  const tabLabel = (path: string, fallback?: string) => resolveTabLabel(path) || fallback || path;

  return (
    <div className="relative z-50" style={{ direction: 'rtl' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 -top-6 w-40 h-40 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(14,121,170,0.15) 0%, rgba(14,121,170,0) 60%)' }} />
        <div className="absolute right-8 -bottom-10 w-48 h-48 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(23,135,184,0.15) 0%, rgba(23,135,184,0) 60%)' }} />
        <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0E78AA]/30 to-transparent" />
      </div>
      <div className="flex min-w-0 items-center gap-2 bg-gradient-to-r from-[#0E78AA]/10 to-[#1787B8]/10 px-3 py-2 backdrop-blur-sm border-b border-[#0E78AA]/20 shadow-sm">
        <div
          ref={scrollerRef}
          data-app-tabs-scroller
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.path;
            const justOpened = justOpenedPath === tab.path && !isActive;
            const label = tabLabel(tab.path, tab.label);
            return (
              <div
                key={tab.path}
                className={`relative flex shrink-0 items-center gap-1 rounded-2xl text-sm transition-all backdrop-blur-sm
                  ${isActive
                    ? 'bg-gradient-to-r from-[#0E78AA] to-[#1787B8] text-white shadow-md'
                    : justOpened
                      ? 'bg-white text-[#0E78AA] ring-2 ring-[#0E78AA] shadow-md'
                      : 'bg-white/70 text-[#094C6B] ring-1 ring-[#D6EAF3] shadow-sm'}
                `}
              >
                <button
                  type="button"
                  ref={isActive ? activeTabRef : undefined}
                  title={label}
                  onClick={() => activateTab(tab.path, tab.href)}
                  className={`flex max-w-[11rem] items-center gap-2 py-2 pe-1 ps-3 text-sm ${
                    isActive ? 'text-white' : 'text-inherit hover:text-[#0E78AA]'
                  }`}
                >
                  <span className="truncate font-medium">{label}</span>
                </button>
                <button
                  type="button"
                  aria-label={`إغلاق ${label}`}
                  className={`me-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    isActive ? 'text-white/80 hover:bg-white/20 hover:text-white' : 'text-gray-400 hover:bg-slate-100 hover:text-gray-700'
                  }`}
                  onClick={(e) => closeTab(tab.path, e)}
                >
                  <IoClose className="h-4 w-4" />
                </button>
                {isActive && (
                  <>
                    <span className="pointer-events-none absolute -bottom-1 left-3 right-3 h-0.5 bg-white/80 rounded-full" />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl bg-white/10" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {tabs.length > 1 ? (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-white/80 px-2 text-xs font-semibold text-[#094C6B] shadow-sm ring-1 ring-[#D6EAF3] hover:bg-white"
              aria-expanded={menuOpen}
              aria-label="قائمة التبويبات المفتوحة"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {tabs.length}
            </button>
            {menuOpen ? (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-[#D6EAF3] bg-white shadow-lg">
                <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-[#094C6B]">
                  التبويبات المفتوحة
                </p>
                <ul className="max-h-72 overflow-y-auto py-1">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.path;
                    const label = tabLabel(tab.path, tab.label);
                    return (
                      <li key={tab.path}>
                        <div className={`flex items-center gap-1 px-2 py-1 ${isActive ? 'bg-[#E8F4FA]' : ''}`}>
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate px-2 py-1.5 text-right text-sm text-[#094C6B]"
                            onClick={() => {
                              activateTab(tab.path, tab.href);
                              setMenuOpen(false);
                            }}
                          >
                            {label}
                          </button>
                          <button
                            type="button"
                            aria-label={`إغلاق ${label}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-slate-100 hover:text-gray-700"
                            onClick={(e) => closeTab(tab.path, e)}
                          >
                            <IoClose className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  className="w-full border-t border-slate-100 px-3 py-2 text-xs font-semibold text-[#0E78AA] hover:bg-[#F6FBFD]"
                  onClick={closeOthers}
                >
                  إغلاق الباقي والإبقاء على الحالي
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
