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
  const sheetRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closerRef = useRef<HTMLParagraphElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const stationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pulseRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const track = trackRef.current;
    const token = tokenRef.current;
    if (!section || !track || !token) return;

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
          const pulses = pulseRefs.current.filter(Boolean) as HTMLSpanElement[];

          const travel = () => {
            const last = stations[stations.length - 1];
            if (!last) return 0;
            const trackBox = track.getBoundingClientRect();
            const lastBox = last.getBoundingClientRect();
            const tokenW = token.offsetWidth;
            const startX = locale === 'ar' ? trackBox.width - tokenW : 0;
            const endX = lastBox.left - trackBox.left + lastBox.width / 2 - tokenW / 2;
            return endX - startX;
          };

          gsap.set(sheetRef.current, { yPercent: 0, opacity: 1 });
          gsap.set(token, { yPercent: -50, x: 0, y: 0 });
          gsap.set(stations, { opacity: compact ? 0.4 : 0.38, scale: 0.98 });
          gsap.set(pulses, { opacity: 0, scale: 0.4 });
          gsap.set(closerRef.current, { opacity: 0, y: 16 });
          gsap.set(headlineRef.current, { opacity: 1, y: 0 });

          if (reduced) {
            gsap.set(token, { x: travel() });
            gsap.set(stations, { opacity: 1, scale: 1 });
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
              scrub: compact ? 0.15 : 0.2,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('light'),
              onEnterBack: () => emitNavTheme('light'),
            },
          });

          tl.to(token, { x: travel, duration: 0.62 }, 0.04);

          stations.forEach((station, i) => {
            const at = 0.04 + (i / Math.max(1, stations.length - 1)) * 0.58;
            tl.to(station, { opacity: 1, scale: 1, duration: 0.06 }, at);
            if (pulses[i]) {
              tl.fromTo(pulses[i], { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.05 }, at);
              tl.to(pulses[i], { opacity: 0.2, duration: 0.06 }, at + 0.06);
            }
          });

          tl.to(headlineRef.current, { opacity: 0.75, duration: 0.08 }, 0.78);
          tl.to(closerRef.current, { opacity: 1, y: 0, duration: 0.1 }, 0.72);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="solutions"
      className="relative h-[220vh] overflow-x-hidden bg-[#061826] text-[var(--gates-ink)] md:h-[260vh]"
      aria-label={copy.transaction.headlineLine1}
    >
      <div
        ref={sheetRef}
        className="sticky top-0 flex h-[100svh] flex-col overflow-hidden bg-[#f7fbfd] px-5 pb-10 pt-24 md:px-12 md:pt-28"
      >
        <div ref={headlineRef} className="mx-auto w-full max-w-[88rem]">
          <SectionLabel index="03">{copy.transaction.eyebrow}</SectionLabel>
          <h2 className="mt-5 max-w-[14ch] text-[clamp(2.2rem,5.2vw,4.8rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
            <span className="block">{copy.transaction.headlineLine1}</span>
            <span className="block text-[var(--gates-blue)]">{copy.transaction.headlineLine2}</span>
          </h2>
        </div>

        <div ref={trackRef} className="relative mx-auto flex w-full max-w-[92rem] flex-1 flex-col justify-center">
          <div className="relative mb-6 hidden h-14 md:block">
            <div className="absolute inset-x-[8%] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#d7eaf4]" />
            <div className="absolute inset-x-[8%] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#0b6fa4]/25" />
            <div
              ref={tokenRef}
              className="absolute start-0 top-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#0b6fa4] text-[0.72rem] font-semibold text-white shadow-[0_16px_36px_rgba(11,111,164,0.4)]"
            >
              G
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {TRANSACTION_STATIONS.map((station, i) => (
              <div
                key={station.id}
                ref={(el) => {
                  stationRefs.current[i] = el;
                }}
                className="relative rounded-2xl border border-[#d7eaf4] bg-white px-4 py-5 shadow-[0_18px_48px_rgba(7,27,43,0.07)]"
              >
                <span
                  ref={(el) => {
                    pulseRefs.current[i] = el;
                  }}
                  className="absolute -top-2 end-5 h-3.5 w-3.5 rounded-full bg-[#1499d6] shadow-[0_0_16px_rgba(20,153,214,0.55)]"
                />
                <p className="text-[0.72rem] font-semibold text-[#0b6fa4]">{station.index}</p>
                <p className="mt-2 text-[1.05rem] font-semibold leading-snug text-[#0b1620] md:text-[1.02rem]">
                  {station.label[locale]}
                </p>
                <p className="mt-2 text-[0.8rem] text-[#4d6472]">{station.detail[locale]}</p>
              </div>
            ))}
          </div>
        </div>

        <p
          ref={closerRef}
          className="mx-auto max-w-[88rem] text-[clamp(1.2rem,2.4vw,1.9rem)] font-medium tracking-[-0.02em] text-[var(--gates-navy)]"
        >
          {copy.transaction.closer}
        </p>
      </div>
    </section>
  );
}

export default TransactionFlow;
