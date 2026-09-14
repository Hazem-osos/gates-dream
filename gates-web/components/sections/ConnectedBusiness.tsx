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
  const canvasRef = useRef<HTMLDivElement>(null);

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

          gsap.set(items, { opacity: 0.34 });
          gsap.set(items[0], { opacity: 1 });
          markPressed(0);
          gsap.set(panels, { opacity: 0, y: 24, scale: 0.97 });
          gsap.set(panels[0], { opacity: 1, y: 0, scale: 1 });
          gsap.set(canvasRef.current, { scale: 0.98, opacity: 0.92 });

          const activate = (index: number) => {
            items.forEach((el, i) => gsap.to(el, { opacity: i === index ? 1 : 0.34, duration: 0.25, overwrite: 'auto' }));
            panels.forEach((el, i) => {
              if (i === index) {
                gsap.fromTo(
                  el,
                  { opacity: 0, y: 28, scale: 0.96 },
                  { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out', overwrite: 'auto' }
                );
              } else {
                gsap.to(el, { opacity: 0, y: -18, scale: 1.03, duration: 0.28, ease: 'power2.in', overwrite: 'auto' });
              }
            });
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
              scrub: compact ? 0.3 : 0.5,
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

          tl.to(canvasRef.current, { scale: compact ? 1.02 : 1.04, opacity: 1, duration: 1 }, 0);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="product"
      className="relative h-[220vh] bg-[#061826] text-[var(--text-inverse)] md:h-[280vh]"
      aria-label={copy.connected.headlineLine1}
    >
      <div className="sticky top-0 flex h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(20,153,214,0.16),transparent_42%)]" aria-hidden />

        <div className="relative z-10 mx-auto grid h-full w-full max-w-[92rem] grid-rows-[auto_1fr] gap-6 px-5 pb-8 pt-24 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.35fr)] md:grid-rows-1 md:items-center md:gap-10 md:px-12 md:pt-28">
          <div>
            <SectionLabel index="02" tone="dark">
              {copy.connected.eyebrow}
            </SectionLabel>
            <h2 className="mt-5 max-w-[16ch] text-[clamp(2rem,4.4vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
              <span className="block">{copy.connected.headlineLine1}</span>
              <span className="mt-1 block text-white/62">{copy.connected.headlineLine2}</span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/50 md:text-base">
              {copy.connected.support}
            </p>

            <ol className="mt-6 space-y-1 md:mt-10 md:space-y-1.5">
              {CONNECTED_MODULES.map((mod, i) => (
                <li key={mod.id}>
                  <button
                    type="button"
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    aria-pressed={i === 0}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start text-[0.9rem] transition-colors hover:bg-white/5 md:text-[1.05rem]"
                    onClick={() => {
                      const st = ScrollTrigger.getById('connected-business');
                      if (!st) return;
                      const progress = (i + 0.5) / CONNECTED_MODULES.length;
                      st.scroll(st.start + (st.end - st.start) * progress);
                    }}
                  >
                    <span className="w-6 text-[0.68rem] tabular-nums text-[#1499d6]">{mod.id}</span>
                    <span>{locale === 'ar' ? mod.ar : mod.en}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div ref={canvasRef} className="relative min-h-[18rem] md:min-h-[36rem]">
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
