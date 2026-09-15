'use client';

import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { AcademyCopilotRoot } from '@/components/academy/AcademyCopilotProvider';
import { GatesAiProvider, useGatesAi } from '@/lib/hooks/useGatesAi';
import { AiChatDrawer } from './AiChatDrawer';
import { AiErrorExplainerRoot } from './AiErrorExplainerRoot';

function isChromeHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return ['/login', '/register', '/forgot-password', '/logout', '/onboarding'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function GatesAiChrome() {
  const pathname = usePathname();
  const { open, setOpen, criticalInsightCount } = useGatesAi();
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openNow = () => {
    cancelClose();
    setOpen(true);
  };

  const closeNow = () => {
    cancelClose();
    setOpen(false);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      if (document.activeElement?.closest('[data-gates-ai-drawer]')) return;
      setOpen(false);
    }, 280);
  };

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-gates-ai-launcher], [data-gates-ai-drawer]')) return;
      closeNow();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (isChromeHidden(pathname)) return null;

  return (
    <>
      <AiChatDrawer onPointerEnter={cancelClose} onPointerLeave={scheduleClose} />
      <button
        type="button"
        data-gates-ai-launcher
        onMouseEnter={openNow}
        onFocus={openNow}
        onMouseLeave={scheduleClose}
        onClick={(event) => {
          event.currentTarget.blur();
          if (open) closeNow();
          else openNow();
        }}
        title="Gates Intelligence (Ctrl + Space)"
        aria-label={open ? 'إغلاق Gates Intelligence' : 'فتح Gates Intelligence'}
        aria-expanded={open}
        className="group fixed bottom-24 left-3 z-[90] flex h-11 items-center gap-1.5 rounded-full border border-[#0E79AA]/15 bg-white/95 px-2.5 text-[#0A3D5E] shadow-[0_8px_24px_-12px_rgba(10,61,94,0.45)] backdrop-blur-sm transition hover:border-[#0E79AA]/40 hover:shadow-[0_10px_28px_-12px_rgba(14,121,170,0.4)]"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#0E79AA] text-white">
          <Sparkles className="h-3.5 w-3.5" />
          {criticalInsightCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-[1.05rem] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
              {criticalInsightCount > 9 ? '9+' : criticalInsightCount}
            </span>
          ) : null}
        </span>
        <span className="pr-1 text-[11px] font-semibold tracking-[0.28em] text-[#0A3D5E]">AI</span>
      </button>
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
