'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { setMarketingLenisStopped } from '../../lib/lenis';

const NAV_LINKS = [
  { href: '#opening', key: 'product' as const },
  { href: '#opening', key: 'solutions' as const },
  { href: '#opening', key: 'industries' as const },
  { href: '#opening', key: 'ai' as const },
  { href: '#opening', key: 'company' as const },
];

export function Navbar() {
  const { copy, toggleLocale, dir } = useMarketingLocale();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onTheme = (event: Event) => {
      const detail = (event as CustomEvent<'light' | 'dark'>).detail;
      if (detail === 'light' || detail === 'dark') setTheme(detail);
    };
    window.addEventListener('gates-nav-theme', onTheme);
    return () => window.removeEventListener('gates-nav-theme', onTheme);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
  const ink = light ? 'text-[var(--gates-navy)]' : 'text-white';
  const bar = scrolled
    ? light
      ? 'bg-white/72 backdrop-blur-xl border-b border-[var(--gates-border)]/70'
      : 'bg-[#061826]/72 backdrop-blur-xl border-b border-white/8'
    : 'bg-transparent';

  return (
    <header className={`fixed inset-x-0 top-0 z-[70] ${ink} ${bar}`}>
      <div className="flex items-center justify-between px-5 py-4 md:px-10">
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[0.28em] text-[var(--gates-blue)]">
          {copy.wordmark}
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="gates-nav-link text-[0.78rem] text-current/70 transition-colors hover:text-current"
            >
              {copy.nav[item.key]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={copy.nav.languageAria}
            className="text-[0.75rem] text-current/70 hover:text-current"
          >
            {copy.nav.language}
          </button>
          <Link
            href="/login"
            className={`hidden rounded-full px-4 py-2 text-[0.75rem] font-medium transition hover:scale-[1.03] md:inline-flex ${
              light ? 'bg-[var(--gates-blue)] text-white' : 'bg-white text-[var(--gates-navy)]'
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
            className="fixed inset-0 z-[75] flex flex-col bg-[#061826] px-8 pt-24 text-white lg:hidden"
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
                    className="text-[clamp(2rem,10vw,3.2rem)] font-semibold leading-none"
                  >
                    {copy.nav[item.key]}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mb-10 inline-flex w-fit rounded-full bg-[var(--gates-blue)] px-5 py-3 text-[0.78rem] text-white"
            >
              {copy.nav.demo}
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
