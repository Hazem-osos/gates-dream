'use client';

import { useLayoutEffect, useRef } from 'react';
import { AI_CAPABILITIES, AI_QUERIES } from '../../data/ai-queries';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

export function GatesAI() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const queryRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const capRef = useRef<HTMLUListElement>(null);

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
          const queries = queryRefs.current.filter(Boolean) as HTMLSpanElement[];
          const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];
          const compact = Boolean(media.conditions?.mobile);
          const reduced = Boolean(media.conditions?.reduce);

          const hiddenClip = locale === 'ar' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
          const visibleClip = 'inset(0 0% 0 0)';

          gsap.set(queries, { opacity: 0, clipPath: hiddenClip });
          gsap.set(panels, { opacity: 0, y: 16 });
          gsap.set(queries[0], { opacity: 1, clipPath: visibleClip });
          gsap.set(panels[0], { opacity: 1, y: 0 });
          gsap.set(capRef.current, { opacity: reduced ? 1 : 0.28 });

          const show = (index: number) => {
            queries.forEach((el, i) => {
              gsap.set(el, {
                opacity: i === index ? 1 : 0,
                clipPath: i === index ? visibleClip : hiddenClip,
              });
            });
            panels.forEach((el, i) => gsap.set(el, { opacity: i === index ? 1 : 0, y: i === index ? 0 : 12 }));
          };

          if (reduced) {
            emitNavTheme('dark');
            return;
          }

          let current = 0;
          gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.55,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('dark'),
              onEnterBack: () => emitNavTheme('dark'),
              onUpdate: (self) => {
                const next = Math.min(
                  AI_QUERIES.length - 1,
                  Math.floor(self.progress * 0.86 * AI_QUERIES.length)
                );
                if (next !== current) {
                  current = next;
                  show(next);
                }
                gsap.set(capRef.current, { opacity: 0.28 + self.progress * 0.72 });
              },
            },
          });
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="ai"
      className="relative h-[200vh] bg-[#0A0A0A] text-[#F5F5F1] md:h-[280vh]"
      aria-label={copy.ai.headlineLine1}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-5 pb-8 pt-24 md:px-12 md:pt-28">
        <div className="mx-auto flex h-full w-full max-w-[88rem] flex-col">
          <div>
            <SectionLabel index="06" tone="dark">
              {copy.ai.eyebrow}
            </SectionLabel>
            <h2 className="mt-5 max-w-[16ch] font-editorial text-[clamp(2.2rem,5.6vw,5.8rem)] leading-[0.92] tracking-[-0.04em]">
              <span className="block">{copy.ai.headlineLine1}</span>
              <span className="block">{copy.ai.headlineLine2}</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm text-white/50 md:text-base">{copy.ai.support}</p>
          </div>

          <div className="mt-8 flex-1 border border-white/12 bg-white/[0.03] md:mt-10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
              <span className="font-mono text-[0.58rem] tracking-[0.22em] text-white/35">{copy.ai.sample}</span>
              <span className="font-mono text-[0.58rem] tracking-[0.2em] text-white/35">GATES / ASK</span>
            </div>
            <div className="border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
              <p className="font-mono text-[0.58rem] tracking-[0.2em] text-white/30">{copy.ai.placeholder}</p>
              <div className="relative mt-2 min-h-[2.6rem] text-[1.05rem] md:min-h-[3rem] md:text-xl">
                {AI_QUERIES.map((query, i) => (
                  <span
                    key={query.id}
                    ref={(el) => {
                      queryRefs.current[i] = el;
                    }}
                    className="absolute inset-0"
                  >
                    <span className="me-3 font-mono text-[0.68rem] text-white/35">
                      {copy.ai.queryLabel} {query.id}
                    </span>
                    {query.question[locale]}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative min-h-[11rem] px-4 py-5 md:min-h-[13rem] md:px-6">
              {AI_QUERIES.map((query, i) => {
                const res = query.response[locale];
                return (
                  <div
                    key={query.id}
                    ref={(el) => {
                      panelRefs.current[i] = el;
                    }}
                    className="absolute inset-x-4 top-5 md:inset-x-6"
                  >
                    <p className="text-xl md:text-2xl">{res.title}</p>
                    <p className="mt-3 font-mono text-[0.58rem] tracking-[0.18em] text-white/30">
                      {locale === 'ar' ? 'العوامل الرئيسية' : 'Main contributors'}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-white/65">
                      {res.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[0.72rem] uppercase tracking-[0.18em] text-white/45">
                      {res.action} →
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <ul
            ref={capRef}
            className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/70"
          >
            {AI_CAPABILITIES.map((cap) => (
              <li key={cap.en}>{cap[locale]}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default GatesAI;
