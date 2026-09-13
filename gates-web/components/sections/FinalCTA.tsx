'use client';

import { useLayoutEffect, useRef } from 'react';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { MagneticButton } from '../animations/MagneticButton';

const HIDDEN = 'inset(100% 0 0 0)';
const VISIBLE = 'inset(0% 0 0 0)';
const EXIT = 'inset(0 0 100% 0)';

export function FinalCTA() {
  const { copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const firstRef = useRef<HTMLHeadingElement>(null);
  const openRef = useRef<HTMLHeadingElement>(null);
  const restRef = useRef<HTMLDivElement>(null);

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

          gsap.set(firstRef.current, { clipPath: VISIBLE });
          gsap.set(openRef.current, { clipPath: reduced ? VISIBLE : HIDDEN });
          gsap.set(restRef.current, { opacity: reduced ? 1 : 0, y: reduced ? 0 : 16 });

          if (reduced) {
            emitNavTheme('dark');
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'power2.inOut' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.6,
              onEnter: () => emitNavTheme('dark'),
              onEnterBack: () => emitNavTheme('dark'),
            },
          });

          tl.to(firstRef.current, { clipPath: EXIT, duration: 0.18 }, 0.28);
          tl.to(openRef.current, { clipPath: VISIBLE, duration: 0.2 }, 0.32);
          tl.to(restRef.current, { opacity: 1, y: 0, duration: 0.16 }, 0.62);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [copy]);

  return (
    <section
      ref={sectionRef}
      id="open"
      className="relative h-[180vh] bg-[#080808] text-[#F5F5F1] md:h-[240vh]"
      aria-label={copy.cta.open}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden px-5 md:px-12">
        <h2
          ref={firstRef}
          className="absolute inset-x-5 top-[28%] max-w-[16ch] font-editorial text-[clamp(2.4rem,6vw,6.2rem)] leading-[0.92] tracking-[-0.04em] md:inset-x-12"
        >
          <span className="block">{copy.cta.firstLine1}</span>
          <span className="block">{copy.cta.firstLine2}</span>
        </h2>
        <h2
          ref={openRef}
          className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 font-editorial text-[clamp(2.2rem,10.5vw,12.5rem)] leading-[0.8] tracking-[-0.06em] md:inset-x-10 md:text-[clamp(3.2rem,13vw,12.5rem)]"
        >
          {copy.cta.open}
        </h2>
        <div ref={restRef} className="absolute inset-x-5 bottom-10 z-10 max-w-[88rem] md:inset-x-12">
          <p className="text-lg text-white/60 md:text-xl">{copy.cta.support}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <MagneticButton href="/login" variant="inverse">
              {copy.cta.demo}
            </MagneticButton>
            <MagneticButton href="#product" variant="ghost" className="text-[#F5F5F1]">
              {copy.cta.explore}
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FinalCTA;
