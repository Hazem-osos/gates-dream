"use client";
import { usePathname, useRouter } from "next/navigation";
import { IoClose } from "react-icons/io5";
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';
import { useAppTabs } from './AppTabsContext';
import { flushPageDrafts, markQcReturn } from '@/lib/drafts/page-drafts';

export default function AppTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const ctx = useAppTabs();
  const tabs = ctx?.tabs ?? [];
  const activeTab = pathname ? normalizeAppPath(pathname) : '';
  const justOpenedPath = ctx?.justOpenedPath ?? null;

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = tabs.filter((tab) => tab.path !== path);
    ctx?.closeTab(path);
    if (path === activeTab) {
      if (remaining.length > 0) {
        const last = remaining[remaining.length - 1];
        router.push(last.href || last.path);
      } else {
        const currentRoot = pathname.split('/')[1];
        router.push(currentRoot ? `/${currentRoot}` : '/');
      }
    }
  };

  return (
    <div className="relative z-30" style={{ direction: 'rtl' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 -top-6 w-40 h-40 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(14,121,170,0.15) 0%, rgba(14,121,170,0) 60%)' }} />
        <div className="absolute right-8 -bottom-10 w-48 h-48 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(23,135,184,0.15) 0%, rgba(23,135,184,0) 60%)' }} />
        <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0E79AA]/30 to-transparent" />
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0E79AA]/10 to-[#1787B8]/10 backdrop-blur-sm border-b border-[#0E79AA]/20 shadow-sm">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        const justOpened = justOpenedPath === tab.path && !isActive;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => {
              if (tab.path !== activeTab) {
                flushPageDrafts();
                markQcReturn(activeTab);
                ctx?.pinCurrentTab();
              }
              router.push(tab.href || tab.path);
            }}
            className={`relative flex items-center gap-3 px-5 py-2 rounded-2xl text-sm transition-all backdrop-blur-sm
              ${isActive
                ? 'bg-gradient-to-r from-[#0E79AA] to-[#1787B8] text-white shadow-md hover:shadow-lg'
                : justOpened
                  ? 'bg-white text-[#0E79AA] ring-2 ring-[#0E79AA] shadow-md'
                  : 'bg-white/70 text-[#094C6B] ring-1 ring-[#D6EAF3] hover:bg-white shadow-sm hover:shadow-md'}
            `}
          >
            <span className="whitespace-nowrap font-medium">{resolveTabLabel(tab.path) || tab.label}</span>
            <IoClose
              className={`w-4 h-4 transition-colors ${isActive ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              onClick={(e) => closeTab(tab.path, e)}
            />
            {isActive && (
              <>
                <span className="absolute -bottom-1 left-3 right-3 h-0.5 bg-white/80 rounded-full" />
                <span className="pointer-events-none absolute inset-0 rounded-2xl bg-white/10" />
              </>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
}
