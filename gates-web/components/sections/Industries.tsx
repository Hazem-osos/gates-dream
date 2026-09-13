'use client';

import { useLayoutEffect, useRef } from 'react';
import { INDUSTRIES } from '../../data/industries';
import { emitNavTheme } from '../../lib/animations';
import { gsap, ScrollTrigger, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

const MASKS = [
  'polygon(0 8%, 100% 0, 100% 92%, 0 100%)',
  'polygon(0 0, 92% 6%, 100% 100%, 8% 96%)',
  'polygon(6% 0, 100% 10%, 94% 100%, 0 88%)',
  'polygon(0 12%, 100% 0, 88% 100%, 0 90%)',
  'polygon(8% 0, 100% 14%, 100% 100%, 0 86%)',
  'polygon(0 0, 100% 8%, 90% 100%, 4% 92%)',
  'polygon(0 10%, 86% 0, 100% 88%, 12% 100%)',
];

export function Industries() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);
  const visualRefs = useRef<(HTMLDivElement | null)[]>([]);
  const capRefs = useRef<(HTMLUListElement | null)[]>([]);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
          mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
        },
        (media) => {
          const rows = rowRefs.current.filter(Boolean) as HTMLElement[];
          const visuals = visualRefs.current.filter(Boolean) as HTMLDivElement[];
          const caps = capRefs.current.filter(Boolean) as HTMLUListElement[];
          const compact = Boolean(media.conditions?.mobile);
          const reduced = Boolean(media.conditions?.reduce);

          gsap.set(caps, { opacity: reduced ? 1 : 0.2, y: reduced ? 0 : 12 });

          if (reduced) {
            emitNavTheme('light');
            return;
          }

          ScrollTrigger.create({
            trigger: section,
            start: 'top 55%',
            end: 'bottom 40%',
            onEnter: () => emitNavTheme('light'),
            onEnterBack: () => emitNavTheme('light'),
          });

          rows.forEach((row, i) => {
            gsap.fromTo(
              caps[i],
              { opacity: 0.15, y: 16 },
              {
                opacity: 1,
                y: 0,
                ease: 'none',
                scrollTrigger: {
                  trigger: row,
                  start: 'top 62%',
                  end: 'center 42%',
                  scrub: true,
                },
              }
            );

            if (!compact && visuals[i]) {
              gsap.fromTo(
                visuals[i],
                { yPercent: -8 },
                {
                  yPercent: 8,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: row,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                  },
                }
              );
            }
          });
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="industries"
      className="bg-[var(--background)] text-[var(--foreground)]"
      aria-label={copy.industries.headline}
    >
      <div className="mx-auto max-w-[88rem] px-5 pb-8 pt-24 md:px-12 md:pt-32">
        <SectionLabel index="07">{copy.industries.eyebrow}</SectionLabel>
        <h2 className="mt-5 max-w-[14ch] font-editorial text-[clamp(2.3rem,5.6vw,5.8rem)] leading-[0.92] tracking-[-0.04em]">
          {copy.industries.headline}
        </h2>
      </div>

      <div>
        {INDUSTRIES.map((industry, i) => (
          <article
            key={industry.id}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className="border-t border-[var(--foreground)]/10"
            onPointerEnter={() => {
              if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
              const el = capRefs.current[i];
              if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.35, overwrite: 'auto' });
            }}
          >
            <div className="mx-auto grid min-h-[58vh] max-w-[88rem] items-center gap-8 px-5 py-12 md:min-h-[72vh] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:px-12 md:py-16">
              <div>
                <p className="font-mono text-[0.68rem] tracking-[0.22em] text-[var(--foreground)]/35">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 font-editorial text-[clamp(2rem,4.4vw,4.4rem)] leading-[0.95] tracking-[-0.03em]">
                  {industry[locale]}
                </h3>
                <ul
                  ref={(el) => {
                    capRefs.current[i] = el;
                  }}
                  className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--foreground)]/55 md:mt-8"
                >
                  {industry.caps[locale].map((cap) => (
                    <li key={cap}>{cap}</li>
                  ))}
                </ul>
              </div>

              <div className="relative h-48 overflow-hidden md:h-80">
                <div
                  ref={(el) => {
                    visualRefs.current[i] = el;
                  }}
                  className="absolute -inset-y-8 inset-x-0"
                  style={{ clipPath: MASKS[i] }}
                  aria-hidden
                >
                  <IndustryMark index={i} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IndustryMark({ index }: { index: number }) {
  const shift = (index * 17) % 40;
  return (
    <div className="relative h-full w-full bg-[#1A1A18]">
      <div className="gates-tech-grid-dark absolute inset-0 opacity-50" />
      <div
        className="absolute border border-white/15"
        style={{ inset: `${12 + (index % 3) * 4}% ${18 + (index % 2) * 6}%` }}
      />
      <div
        className="absolute bg-[var(--accent)]/80"
        style={{
          width: '28%',
          height: '3px',
          top: `${28 + shift / 2}%`,
          insetInlineStart: `${18 + shift / 3}%`,
        }}
      />
      <div
        className="absolute border border-white/20"
        style={{
          width: '22%',
          height: '34%',
          top: `${40 + (index % 4) * 3}%`,
          insetInlineEnd: `${16 + (index % 3) * 4}%`,
        }}
      />
    </div>
  );
}

export default Industries;
