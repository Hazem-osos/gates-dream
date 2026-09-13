'use client';

import { useLayoutEffect, useRef } from 'react';
import { REGIONAL_CAPABILITIES } from '../../data/regional';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

/** Schematic MENA — original drawing, not a licensed cartographic product. */
function MenaMap({ egypt, saudi }: { egypt: string; saudi: string }) {
  return (
    <svg viewBox="0 0 420 280" className="h-auto w-full" role="img" aria-label={`${egypt}, ${saudi}`}>
      <g fill="none" stroke="currentColor" strokeWidth="0.8" className="text-white/20">
        <path d="M18 118 L92 104 L118 128 L96 168 L28 176 Z" />
        <path d="M118 92 L168 78 L188 118 L154 148 L122 132 Z" />
        <path d="M188 62 L248 48 L268 78 L230 96 L192 86 Z" />
        <path d="M268 70 L318 58 L338 92 L292 108 L262 90 Z" />
        <path d="M318 96 L392 88 L404 148 L348 168 L312 132 Z" />
      </g>
      <g className="text-[var(--accent)]">
        <path
          d="M148 118 C162 108 176 112 182 128 C186 146 174 168 158 176 C142 170 136 148 148 118 Z"
          fill="currentColor"
          fillOpacity="0.35"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M214 118 C248 108 292 118 308 148 C318 172 292 198 248 204 C214 192 198 158 214 118 Z"
          fill="currentColor"
          fillOpacity="0.35"
          stroke="currentColor"
          strokeWidth="1"
        />
      </g>
      <g className="fill-white" style={{ fontSize: 9, letterSpacing: 0.8 }}>
        <text x="156" y="148" textAnchor="middle">
          {egypt}
        </text>
        <text x="256" y="164" textAnchor="middle">
          {saudi}
        </text>
      </g>
    </svg>
  );
}

export function RegionalExpansion() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.set(mapRef.current, { opacity: reduced ? 1 : 0.2, y: reduced ? 0 : 24 });

      gsap.to(mapRef.current, {
        opacity: 1,
        y: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          end: 'center 45%',
          scrub: reduced ? false : 0.5,
          onEnter: () => emitNavTheme('dark'),
          onEnterBack: () => emitNavTheme('dark'),
        },
      });
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="regional"
      className="bg-[#070B12] px-5 py-24 text-[#F5F5F1] md:px-12 md:py-36"
      aria-label={copy.regional.headline}
    >
      <div className="mx-auto grid max-w-[88rem] items-center gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <SectionLabel index="10" tone="dark">
            {copy.regional.eyebrow}
          </SectionLabel>
          <h2 className="mt-5 max-w-[14ch] font-editorial text-[clamp(2.2rem,5vw,5.2rem)] leading-[0.92] tracking-[-0.035em]">
            {copy.regional.headline}
          </h2>
          <ul className="mt-10 space-y-3 text-sm text-white/60 md:text-base">
            {REGIONAL_CAPABILITIES.map((item) => (
              <li key={item.en} className="border-s border-white/20 ps-4">
                {item[locale]}
              </li>
            ))}
          </ul>
          <p className="mt-8 font-mono text-[0.62rem] tracking-[0.16em] text-white/30">{copy.regional.note}</p>
        </div>
        <div ref={mapRef} className="border border-white/10 p-6 md:p-10">
          <MenaMap egypt={copy.regional.egypt} saudi={copy.regional.saudi} />
        </div>
      </div>
    </section>
  );
}

export default RegionalExpansion;
