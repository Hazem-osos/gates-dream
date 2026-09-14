'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { setMarketingLenisStopped } from '../../lib/lenis';

const NAV_LINKS = [
  { href: '#product', key: 'product' as const },
  { href: '#solutions', key: 'solutions' as const },
  { href: '#industries', key: 'industries' as const },
  { href: '#ai', key: 'ai' as const },
  { href: '#company', key: 'company' as const },
];

export function Navbar() {
  const { copy, toggleLocale, dir } = useMarketingLocale();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onTheme = (event: Event) => {
      const detail = (event as CustomEvent<'light' | 'dark'>).detail;
      if (detail === 'light' || detail === 'dark') setTheme(detail);
    };
    window.addEventListener('gates-nav-theme', onTheme);
    return () => window.removeEventListener('gates-nav-theme', onTheme);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    setMarketingLenisStopped(open);
    return () => {
      document.body.style.overflow = '';
      setMarketingLenisStopped(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const light = theme === 'light';
  const ink = light ? 'text-[#0A0A0A]' : 'text-[#F5F5F1]';

  return (
    <header className={`fixed inset-x-0 top-0 z-[70] ${ink}`}>
      <div className="flex items-center justify-between px-5 py-5 md:px-10">
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[0.32em]">
          {copy.wordmark}
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="gates-nav-link text-[0.72rem] uppercase tracking-[0.2em] text-current/70 transition-colors hover:text-current"
            >
              {copy.nav[item.key]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={copy.nav.languageAria}
            className="text-[0.68rem] uppercase tracking-[0.18em] text-current/70 hover:text-current"
          >
            {copy.nav.language}
          </button>
          <Link
            href="/login"
            className={`hidden px-4 py-2 text-[0.68rem] uppercase tracking-[0.18em] md:inline-flex ${
              light ? 'bg-[var(--gates-blue)] text-white' : 'bg-[#F5F5F1] text-[#080808]'
            }`}
          >
            {copy.nav.demo}
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-expanded={open}
            aria-controls="gates-mobile-menu"
            aria-label={open ? copy.nav.close : copy.nav.menu}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`block h-px w-5 bg-current transition ${open ? 'translate-y-[3.5px] rotate-45' : ''}`} />
            <span className={`block h-px w-5 bg-current transition ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-px w-5 bg-current transition ${open ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="gates-mobile-menu"
            role="dialog"
            aria-modal="true"
            dir={dir}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[75] flex flex-col bg-[#080808] px-8 pt-24 text-[#F5F5F1] lg:hidden"
          >
            <nav className="flex flex-1 flex-col gap-6" aria-label="Mobile">
              {NAV_LINKS.map((item, i) => (
                <motion.div
                  key={item.key}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.06 * i }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="font-editorial text-[clamp(2rem,10vw,3.5rem)] leading-none"
                  >
                    {copy.nav[item.key]}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mb-10 inline-flex w-fit bg-[#F5F5F1] px-5 py-3 text-[0.72rem] uppercase tracking-[0.2em] text-[#080808]"
            >
              {copy.nav.demo}
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
