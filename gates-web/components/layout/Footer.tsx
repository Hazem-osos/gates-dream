'use client';

import Link from 'next/link';
import { useMarketingLocale } from '../../lib/marketing/locale';

const COLUMNS = [
  {
    key: 'product' as const,
    links: [
      { href: '#opening', en: 'Opening', ar: 'الافتتاح' },
      { href: '/login', en: 'Sign in', ar: 'دخول' },
    ],
  },
  {
    key: 'solutions' as const,
    links: [{ href: '#opening', en: 'Connected operations', ar: 'عمليات متصلة' }],
  },
  {
    key: 'industries' as const,
    links: [{ href: '#opening', en: 'All industries', ar: 'كل القطاعات' }],
  },
  {
    key: 'company' as const,
    links: [{ href: '#opening', en: 'Story', ar: 'الحكاية' }],
  },
];

export function Footer() {
  const { locale, copy } = useMarketingLocale();

  return (
    <footer className="border-t border-[#d7eaf4] bg-[#f7fbfd] px-5 pb-10 pt-20 text-[#071b2b] md:px-12 md:pt-28">
      <div className="mx-auto max-w-[88rem]">
        <p className="font-editorial text-[clamp(4.5rem,16vw,14rem)] leading-[0.78] tracking-[-0.06em] text-[#0b6fa4]">
          {copy.wordmark}
        </p>

        <div className="mt-16 grid gap-10 border-t border-[#d7eaf4] pt-12 md:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.key}>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[#4d6472]">
                {copy.footer[col.key]}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#071b2b]/70">
                {col.links.map((link) => (
                  <li key={`${col.key}-${link.en}`}>
                    <Link href={link.href} className="gates-nav-link hover:text-[#0b6fa4]">
                      {link[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[#4d6472]">
              {copy.footer.contact}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[#071b2b]/70">
              <li>{copy.footer.egypt}</li>
              <li>{copy.footer.saudi}</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-[#d7eaf4] pt-6 text-[0.72rem] uppercase tracking-[0.16em] text-[#4d6472]">
          <p>© {copy.wordmark}</p>
          <nav id="legal" className="flex gap-5" aria-label={copy.footer.legal}>
            <span title={copy.footer.legalSoon}>{copy.footer.privacy}</span>
            <span title={copy.footer.legalSoon}>{copy.footer.terms}</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
