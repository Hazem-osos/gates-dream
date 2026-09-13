'use client';

import { useLayoutEffect, useRef } from 'react';
import { TRANSACTION_STATIONS } from '../../data/transaction';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

export function TransactionFlow() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const closerRef = useRef<HTMLParagraphElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const stationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pulseRefs = useRef<(SVGCircleElement | null)[]>([]);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const rail = railRef.current;
    const token = tokenRef.current;
    if (!section || !rail || !token) return;

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
          const stations = stationRefs.current.filter(Boolean) as HTMLDivElement[];
          const pulses = pulseRefs.current.filter(Boolean) as SVGCircleElement[];
          const dir = locale === 'ar' ? -1 : 1;

          const travel = () => {
            const max = rail.offsetWidth - token.offsetWidth;
            return dir * Math.max(0, max);
          };

          gsap.set(token, { yPercent: -50, x: 0 });
          gsap.set(stations, { opacity: compact ? 0.35 : 0.22 });
          gsap.set(pulses, { opacity: 0 });
          gsap.set(closerRef.current, { opacity: 0, y: 20 });
          gsap.set(coreRef.current, { scale: 1 });
          gsap.set(headlineRef.current, { opacity: 1, y: 0 });

          if (reduced) {
            gsap.set(token, { yPercent: -50, x: travel() * 0.55 });
            gsap.set(stations, { opacity: 1 });
            gsap.set(closerRef.current, { opacity: 1, y: 0 });
            emitNavTheme('light');
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.65,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('light'),
              onEnterBack: () => emitNavTheme('light'),
            },
          });

          // 0–12% sale sits at origin
          tl.to(token, { x: 0, duration: 0.12 }, 0);

          // 12–88% token travels the GATES rail; stations ignite in sequence
          tl.to(token, { x: travel, duration: 0.76, ease: 'power1.inOut' }, 0.12);
          tl.to(coreRef.current, { scale: compact ? 1.06 : 1.12, duration: 0.2 }, 0.38);

          stations.forEach((station, i) => {
            const at = 0.18 + i * 0.13;
            tl.to(station, { opacity: 1, duration: 0.06 }, at);
            if (pulses[i]) {
              tl.fromTo(
                pulses[i],
                { opacity: 0, attr: { r: 2 } },
                { opacity: 1, attr: { r: 7 }, duration: 0.08 },
                at
              );
              tl.to(pulses[i], { opacity: 0, duration: 0.08 }, at + 0.08);
            }
          });

          tl.to(headlineRef.current, { opacity: 0.2, y: compact ? -8 : -16, duration: 0.1 }, 0.84);
          tl.to(closerRef.current, { opacity: 1, y: 0, duration: 0.12 }, 0.86);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="solutions"
      className="relative h-[200vh] overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] md:h-[300vh]"
      aria-label={copy.transaction.headlineLine1}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-5 pb-8 pt-24 md:px-12 md:pt-28">
        <div ref={headlineRef} className="mx-auto w-full max-w-[88rem]">
          <SectionLabel index="03">{copy.transaction.eyebrow}</SectionLabel>
          <h2 className="mt-5 max-w-[14ch] font-editorial text-[clamp(2.4rem,6vw,6.5rem)] leading-[0.9] tracking-[-0.04em]">
            <span className="block">{copy.transaction.headlineLine1}</span>
            <span className="block">{copy.transaction.headlineLine2}</span>
          </h2>
        </div>

        <div className="relative mx-auto flex w-full max-w-[88rem] flex-1 flex-col justify-center">
          <div className="mb-6 flex items-center justify-between gap-4 md:mb-10">
            <p className="font-mono text-[0.62rem] tracking-[0.22em] text-[var(--foreground)]/40">
              {copy.transaction.sale}
            </p>
            <div
              ref={coreRef}
              className="border border-[var(--foreground)]/20 px-4 py-2 font-mono text-[0.68rem] tracking-[0.28em]"
            >
              {copy.transaction.core}
            </div>
          </div>

          <div ref={railRef} className="relative h-16 md:h-20">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--foreground)]/15" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {TRANSACTION_STATIONS.map((station, i) => (
                <circle
                  key={station.id}
                  ref={(el) => {
                    pulseRefs.current[i] = el;
                  }}
                  cx={`${18 + i * 16}%`}
                  cy="50%"
                  r="2"
                  fill="var(--accent)"
                />
              ))}
            </svg>
            <div
              ref={tokenRef}
              className="absolute start-0 top-1/2 z-10 flex h-10 items-center border border-[var(--foreground)] bg-[var(--background)] px-3 font-mono text-[0.58rem] tracking-[0.16em] md:h-12 md:px-4"
            >
              {copy.transaction.sale}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-5 md:gap-5">
            {TRANSACTION_STATIONS.map((station, i) => (
              <div
                key={station.id}
                ref={(el) => {
                  stationRefs.current[i] = el;
                }}
                className="border border-[var(--foreground)]/12 px-3 py-3 md:px-4 md:py-4"
              >
                <p className="font-mono text-[0.58rem] tracking-[0.18em] text-[var(--foreground)]/40">
                  {station.label[locale]}
                </p>
                <p className="mt-2 text-sm md:text-base">{station.detail[locale]}</p>
              </div>
            ))}
          </div>
        </div>

        <p
          ref={closerRef}
          className="mx-auto max-w-[88rem] font-editorial text-[clamp(1.4rem,3vw,2.4rem)] tracking-[-0.03em] text-[var(--foreground)]"
        >
          {copy.transaction.closer}
        </p>
      </div>
    </section>
  );
}

export default TransactionFlow;
