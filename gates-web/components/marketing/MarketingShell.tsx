'use client';

import { IBM_Plex_Sans_Arabic, Newsreader } from 'next/font/google';
import { useEffect } from 'react';
import { Navbar } from '../layout/Navbar';
import { ScrollProgress } from '../animations/ScrollProgress';
import { createMarketingLenis, scrollToHash } from '../../lib/lenis';
import { registerGsapPlugins, ScrollTrigger } from '../../lib/gsap';
import { LocaleProvider, useMarketingLocale } from '../../lib/marketing/locale';

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

function MarketingDocument({ children }: { children: React.ReactNode }) {
  const { locale, dir, copy } = useMarketingLocale();

  useEffect(() => {
    registerGsapPlugins();
    const html = document.documentElement;
    html.classList.add('gates-marketing-root');
    html.lang = locale;
    html.dir = dir;
    const previousOverflow = html.style.overflowX;
    html.style.overflowX = 'hidden';
    return () => {
      html.classList.remove('gates-marketing-root');
      html.lang = 'en';
      html.dir = 'rtl';
      html.style.overflowX = previousOverflow;
    };
  }, [locale, dir]);

  useEffect(() => {
    const destroy = createMarketingLenis();
    return () => {
      destroy?.();
    };
  }, []);

  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    const t1 = window.setTimeout(refresh, 80);
    const t2 = window.setTimeout(refresh, 480);
    void document.fonts?.ready.then(refresh);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [locale]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href^="#"]');
      if (!(link instanceof HTMLAnchorElement)) return;
      const hash = link.getAttribute('href');
      if (!hash || hash === '#' || hash === '#legal') return;
      event.preventDefault();
      scrollToHash(hash);
      window.history.replaceState(null, '', hash);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div
      className={`${ibmArabic.variable} ${newsreader.variable} gates-marketing min-h-screen`}
      data-locale={locale}
      dir={dir}
    >
      <a className="gates-skip" href="#opening">
        {copy.nav.skip}
      </a>
      <ScrollProgress />
      <Navbar />
      {children}
    </div>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <MarketingDocument>{children}</MarketingDocument>
    </LocaleProvider>
  );
}
