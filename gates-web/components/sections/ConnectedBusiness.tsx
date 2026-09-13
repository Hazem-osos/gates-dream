'use client';

import { useLayoutEffect, useRef } from 'react';
import { CONNECTED_MODULES } from '../../data/modules';
import { emitNavTheme } from '../../lib/animations';
import { gsap, ScrollTrigger, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';
import { ModuleVisual } from './connected/ModuleVisuals';

export function ConnectedBusiness() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wordRef = useRef<HTMLParagraphElement>(null);

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
          const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
          const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];
          const reduced = Boolean(media.conditions?.reduce);
          const compact = Boolean(media.conditions?.mobile);

          const markPressed = (index: number) => {
            items.forEach((el, i) => el.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
          };
          gsap.set(items, { opacity: 0.28 });
          gsap.set(items[0], { opacity: 1 });
          markPressed(0);
          gsap.set(panels, { opacity: 0 });
          gsap.set(panels[0], { opacity: 1 });
          gsap.set(wordRef.current, { opacity: 0.055, scale: 1 });

          const activate = (index: number) => {
            items.forEach((el, i) => gsap.set(el, { opacity: i === index ? 1 : 0.28 }));
            panels.forEach((el, i) => gsap.set(el, { opacity: i === index ? 1 : 0 }));
            markPressed(index);
          };

          if (reduced) {
            emitNavTheme('dark');
            return;
          }

          let current = 0;
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              id: 'connected-business',
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.55,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('dark'),
              onEnterBack: () => emitNavTheme('dark'),
              onUpdate: (self) => {
                const next = Math.min(
                  CONNECTED_MODULES.length - 1,
                  Math.floor(self.progress * 0.999 * CONNECTED_MODULES.length)
                );
                if (next !== current) {
                  current = next;
                  activate(next);
                }
              },
            },
          });

          tl.to(wordRef.current, { scale: compact ? 1.04 : 1.12, duration: 1 }, 0);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="product"
      className="relative h-[200vh] bg-[var(--surface-ink)] text-[var(--text-inverse)] md:h-[280vh]"
      aria-label={copy.connected.headlineLine1}
    >
      <div className="sticky top-0 flex h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="gates-tech-grid-dark h-full w-full" />
        </div>
        <p
          ref={wordRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[22%] text-center font-editorial text-[clamp(3.4rem,12vw,11rem)] leading-none tracking-[-0.05em] text-white"
        >
          {copy.connected.bgWord}
        </p>

        <div className="relative z-10 mx-auto grid h-full w-full max-w-[88rem] grid-rows-[auto_1fr] gap-6 px-5 pb-8 pt-24 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-1 md:items-center md:gap-16 md:px-12 md:pt-28">
          <div>
            <SectionLabel index="02" tone="dark">
              {copy.connected.eyebrow}
            </SectionLabel>
            <h2 className="mt-5 max-w-[16ch] font-editorial text-[clamp(2rem,4.6vw,4.6rem)] leading-[0.95] tracking-[-0.03em]">
              <span className="block">{copy.connected.headlineLine1}</span>
              <span className="mt-1 block text-white/62">{copy.connected.headlineLine2}</span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/50 md:text-base">
              {copy.connected.support}
            </p>

            <ol className="mt-5 space-y-1.5 md:mt-12 md:space-y-2.5">
              {CONNECTED_MODULES.map((mod, i) => (
                <li key={mod.id}>
                  <button
                    type="button"
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    aria-pressed={i === 0}
                    className="flex w-full items-baseline gap-3 text-start text-[0.82rem] md:gap-4 md:text-lg"
                    onClick={() => {
                      const st = ScrollTrigger.getById('connected-business');
                      if (!st) return;
                      const progress = (i + 0.5) / CONNECTED_MODULES.length;
                      st.scroll(st.start + (st.end - st.start) * progress);
                    }}
                  >
                    <span className="font-mono text-[0.68rem] tracking-[0.18em] text-white/35">{mod.id}</span>
                    <span>{locale === 'ar' ? mod.ar : mod.en}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative min-h-[16rem] md:min-h-[28rem]">
            {CONNECTED_MODULES.map((mod, i) => (
              <ModuleVisual
                key={mod.id}
                moduleKey={mod.key}
                sample={copy.connected.sample}
                locale={locale}
                panelRef={(el) => {
                  panelRefs.current[i] = el;
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ConnectedBusiness;
