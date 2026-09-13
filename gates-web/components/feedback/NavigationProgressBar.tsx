'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

function isInternalNavigation(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return `${url.pathname}${url.search}` !== `${window.location.pathname}${window.location.search}`;
  } catch {
    return false;
  }
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const trickleRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const clearTimers = () => {
    if (trickleRef.current) window.clearInterval(trickleRef.current);
    if (hideRef.current) window.clearTimeout(hideRef.current);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);
    trickleRef.current = null;
    hideRef.current = null;
    safetyRef.current = null;
  };

  const start = () => {
    if (activeRef.current) return;
    activeRef.current = true;
    clearTimers();
    setVisible(true);
    setProgress(12);
    trickleRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) return current;
        return current + Math.max(1.2, (90 - current) * 0.08);
      });
    }, 180);
    safetyRef.current = window.setTimeout(() => complete(), 10000);
  };

  const complete = () => {
    if (!activeRef.current && !visible) return;
    clearTimers();
    setProgress(100);
    hideRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      activeRef.current = false;
    }, 220);
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (isInternalNavigation(anchor)) start();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => clearTimers(), []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200]"
      aria-hidden={!visible}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-[2.5px] origin-right bg-[#0E79AA] transition-[width,opacity] duration-300 ease-in-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          boxShadow: '0 0 10px #0E79AA, 0 0 5px #0E79AA',
        }}
      />
    </div>
  );
}
