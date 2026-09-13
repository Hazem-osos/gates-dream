'use client';

import { Suspense, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { AcademyCopilotRoot } from '@/components/academy/AcademyCopilotProvider';
import { GatesAiProvider, useGatesAi } from '@/lib/hooks/useGatesAi';
import { AiChatDrawer } from './AiChatDrawer';
import { AiErrorExplainerRoot } from './AiErrorExplainerRoot';

function isChromeHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  return ['/login', '/register', '/forgot-password', '/logout', '/onboarding'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function GatesAiChrome() {
  const pathname = usePathname();
  const { open, toggle, criticalInsightCount } = useGatesAi();
  if (isChromeHidden(pathname)) return null;

  return (
    <>
      <AiChatDrawer />
      {!open ? (
        <button
          type="button"
          onClick={toggle}
          title="Gates Intelligence (Ctrl + Space)"
          aria-label="فتح Gates Intelligence"
          className="group fixed bottom-24 left-0 z-[70] flex items-center gap-2 rounded-r-2xl border border-slate-800/20 border-l-0 bg-slate-900 py-2 pl-2 pr-2.5 text-white shadow-[0_12px_32px_-14px_rgba(15,23,42,0.75)] transition hover:bg-[#0E79AA]"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#0E79AA] shadow-[0_0_14px_rgba(0,194,255,0.4)]">
            <Sparkles className="h-3.5 w-3.5" />
            {criticalInsightCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-[1.05rem] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 ring-2 ring-slate-900">
                {criticalInsightCount > 9 ? '9+' : criticalInsightCount}
              </span>
            ) : null}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[10px] font-semibold tracking-wide">Intelligence</span>
            <span className="block text-[9px] text-slate-400 group-hover:text-white/80">AI Copilot</span>
          </span>
        </button>
      ) : null}
    </>
  );
}

export function GatesAiRoot({ children }: { children: ReactNode }) {
  return (
    <GatesAiProvider>
      {children}
      <GatesAiChrome />
      <AiErrorExplainerRoot />
      <Suspense fallback={null}>
        <AcademyCopilotRoot />
      </Suspense>
    </GatesAiProvider>
  );
}
