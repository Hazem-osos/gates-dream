'use client';

import { useLayoutEffect, useRef } from 'react';
import { PRODUCT_MODULES } from '../../data/product';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

export function ProductShowcase() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const screenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hotspotRefs = useRef<(HTMLDivElement | null)[]>([]);

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
          const compact = Boolean(media.conditions?.mobile);
          const reduced = Boolean(media.conditions?.reduce);
          const screens = screenRefs.current.filter(Boolean) as HTMLDivElement[];
          const spots = hotspotRefs.current.filter(Boolean) as HTMLDivElement[];

          gsap.set(frameRef.current, { y: compact ? 24 : 64, scale: compact ? 0.92 : 0.82 });
          gsap.set(screens, { opacity: 0 });
          gsap.set(screens[0], { opacity: 1 });
          gsap.set(spots, { opacity: 0, x: 8 });
          gsap.set(spots[0], { opacity: 1, x: 0 });

          const show = (index: number) => {
            screens.forEach((el, i) => gsap.set(el, { opacity: i === index ? 1 : 0 }));
            spots.forEach((el, i) => gsap.set(el, { opacity: i === index ? 1 : 0, x: i === index ? 0 : 8 }));
          };

          if (reduced) {
            gsap.set(frameRef.current, { y: 0, scale: 1 });
            emitNavTheme('dark');
            return;
          }

          let current = 0;
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.6,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('dark'),
              onEnterBack: () => emitNavTheme('dark'),
              onUpdate: (self) => {
                const next = Math.min(
                  PRODUCT_MODULES.length - 1,
                  Math.floor(self.progress * 0.88 * PRODUCT_MODULES.length)
                );
                if (next !== current) {
                  current = next;
                  show(next);
                }
              },
            },
          });

          tl.to(frameRef.current, { y: 0, scale: 1, duration: 0.22, ease: 'power2.out' }, 0);
          tl.to(frameRef.current, { y: compact ? -8 : -20, scale: compact ? 1.02 : 1.06, duration: 0.78 }, 0.22);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="platform"
      className="relative h-[200vh] bg-[#080808] text-[#F5F5F1] md:h-[280vh]"
      aria-label={copy.product.headlineLine1}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-5 pb-8 pt-24 md:px-12 md:pt-28">
        <div className="mx-auto w-full max-w-[88rem]">
          <SectionLabel index="08" tone="dark">
            {copy.product.eyebrow}
          </SectionLabel>
          <h2 className="mt-5 max-w-[16ch] font-editorial text-[clamp(2.1rem,5vw,5.2rem)] leading-[0.92] tracking-[-0.04em]">
            <span className="block">{copy.product.headlineLine1}</span>
            <span className="block text-white/55">{copy.product.headlineLine2}</span>
          </h2>
        </div>

        <div className="relative mx-auto mt-6 flex w-full max-w-[72rem] flex-1 items-center justify-center">
          <div
            ref={frameRef}
            className="w-full overflow-hidden border border-white/12 bg-[#0C0C0C]"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
              <span className="mx-auto font-mono text-[0.62rem] tracking-[0.14em] text-white/35">
                gates.system / product
              </span>
            </div>
            <div className="relative min-h-[16rem] p-4 md:min-h-[22rem] md:p-8">
              {PRODUCT_MODULES.map((mod, i) => (
                <div
                  key={mod.id}
                  ref={(el) => {
                    screenRefs.current[i] = el;
                  }}
                  className="absolute inset-4 md:inset-8"
                >
                  <p className="font-mono text-[0.58rem] tracking-[0.22em] text-white/30">{copy.product.sample}</p>
                  <p className="mt-2 text-xl md:text-3xl">{mod[locale]}</p>
                  <p className="mt-1 text-xs text-white/40">{copy.product.note}</p>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {['01', '02', '03'].map((n) => (
                      <div key={n} className="h-14 border border-white/10 bg-white/[0.03] md:h-24">
                        <span className="block p-2 font-mono text-[0.55rem] text-white/25">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none relative mt-3 min-h-[3.25rem] md:absolute md:inset-x-0 md:bottom-2 md:mt-0 md:flex md:justify-end">
            {PRODUCT_MODULES.map((mod, i) => (
              <div
                key={mod.id}
                ref={(el) => {
                  hotspotRefs.current[i] = el;
                }}
                className="absolute bottom-0 end-0 border border-white/15 bg-[#080808]/80 px-3 py-2"
              >
                <p className="font-mono text-[0.55rem] tracking-[0.18em] text-white/35">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="mt-1 text-[0.72rem] uppercase tracking-[0.14em]">{mod.hotspot[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProductShowcase;
