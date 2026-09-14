'use client';

import { useLayoutEffect, useRef } from 'react';
import { PRODUCT_SCALE, emitNavTheme } from '../../lib/animations';
import { ScrollTrigger, gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import {
  CompanyStoryOverlay,
  LocationLiveChip,
  buildCompanyStoryTimeline,
  createCompanyStoryRefs,
  hideCompanyStory,
  showCompanyStoryEnd,
} from './CompanyStoryJourney';
import { ExecutiveDashboard, LocationPlatform } from './product-surfaces';

const PHASE = PRODUCT_SCALE.phases;
const LETTERS = ['G', 'A', 'T', 'E', 'S'] as const;

export function ProductScaleJourney() {
  const { copy, locale } = useMarketingLocale();
  const c = copy.productJourney;
  const storyCopy = copy.companyStory;

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const dashWrapRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const salesRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const accountingRef = useRef<HTMLDivElement>(null);
  const understandRef = useRef<HTMLDivElement>(null);
  const hqRef = useRef<HTMLDivElement>(null);
  const locRefs = useRef<(HTMLDivElement | null)[]>([]);
  const linesRef = useRef<SVGSVGElement>(null);
  const packetsRef = useRef<(SVGCircleElement | null)[]>([]);
  const storyRefs = useRef(createCompanyStoryRefs());

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const stage = stageRef.current;
    const world = worldRef.current;
    const word = wordRef.current;
    const veil = veilRef.current;
    const dashWrap = dashWrapRef.current;
    const dash = dashRef.current;
    const sales = salesRef.current;
    const inventory = inventoryRef.current;
    const accounting = accountingRef.current;
    if (!section || !stage || !world || !word || !veil || !dashWrap || !dash || !sales || !inventory || !accounting) {
      return;
    }

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
          const locations = locRefs.current.filter(Boolean) as HTMLDivElement[];
          const packets = packetsRef.current.filter(Boolean) as SVGCircleElement[];
          const panels = [sales, inventory, accounting];
          const scaleVh = compact ? PRODUCT_SCALE.mobileVh : PRODUCT_SCALE.desktopVh;
          const story = storyRefs.current;

          const setStart = () => {
            gsap.set(world, { x: 0, y: 0, scale: 1, rotateX: 0, force3D: true });
            gsap.set(word, { scale: 1, x: 0, y: 0, opacity: 1, force3D: true });
            gsap.set(veil, { opacity: 0, scale: 0.2 });
            gsap.set(dashWrap, { opacity: 0, scale: 0.72, rotateX: 16, y: 48, force3D: true });
            gsap.set(panels, { opacity: 1, scale: 1 });
            gsap.set(understandRef.current, { opacity: 0, y: 24 });
            gsap.set(hqRef.current, { opacity: 0, y: 20, scale: 0.92 });
            gsap.set(locations, { opacity: 0, scale: 0.86, y: 18 });
            gsap.set(linesRef.current, { opacity: 0 });
            gsap.set(packets, { opacity: 0 });
            hideCompanyStory(gsap, story);
          };

          const setScaleEnd = () => {
            gsap.set(word, { opacity: 0, scale: 8 });
            gsap.set(veil, { opacity: 0 });
            gsap.set(dashWrap, { opacity: 1, scale: compact ? 0.46 : 0.36, rotateX: 10, y: compact ? -40 : -70 });
            gsap.set(world, { scale: compact ? 0.78 : 0.7, y: 34, rotateX: 14 });
            gsap.set(understandRef.current, { opacity: 0 });
            gsap.set(hqRef.current, { opacity: 1, y: 0, scale: 1 });
            gsap.set(locations, { opacity: 1, scale: 1, y: 0 });
            gsap.set(linesRef.current, { opacity: 0.7 });
            gsap.set(packets, { opacity: 0.9 });
          };

          setStart();
          emitNavTheme('light');
          if (reduced) {
            setScaleEnd();
            showCompanyStoryEnd(gsap, story);
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none', force3D: true },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: `+=${scaleVh}vh`,
              scrub: compact ? 0.55 : 0.72,
              invalidateOnRefresh: true,
              onUpdate: () => emitNavTheme('light'),
            },
          });

          tl.to({}, { duration: 0.04 }, 0);
          tl.to(word, { scale: compact ? 6.4 : 9.2, x: compact ? 8 : 36, y: compact ? 10 : 18, duration: 0.1 }, 0.04);
          tl.to(veil, { opacity: 1, scale: 2.4, duration: 0.08 }, 0.08);
          tl.to(word, { opacity: 0, duration: 0.04 }, PHASE.enterEnd - 0.04);

          tl.to(
            dashWrap,
            { opacity: 1, scale: 1, rotateX: 6, y: 0, duration: PHASE.dashSettleEnd - PHASE.enterEnd },
            PHASE.enterEnd
          );
          tl.to(veil, { opacity: 0, duration: 0.06 }, PHASE.enterEnd + 0.04);
          tl.to({}, { duration: 0.04 }, PHASE.dashSettleEnd - 0.04);

          tl.to(world, { x: compact ? 0 : 70, scale: compact ? 1.08 : 1.16, duration: 0.1 }, PHASE.dashSettleEnd);
          tl.to(sales, { scale: 1.04, opacity: 1, duration: 0.08 }, PHASE.dashSettleEnd);
          tl.to([inventory, accounting], { opacity: 0.34, duration: 0.08 }, PHASE.dashSettleEnd);
          tl.to({}, { duration: 0.04 }, PHASE.salesEnd - 0.04);

          tl.to(world, { x: compact ? 0 : -30, y: compact ? -24 : -36, scale: compact ? 1.1 : 1.18, duration: 0.1 }, PHASE.salesEnd);
          tl.to(inventory, { opacity: 1, scale: 1.04, duration: 0.08 }, PHASE.salesEnd);
          tl.to([sales, accounting], { opacity: 0.34, scale: 1, duration: 0.08 }, PHASE.salesEnd);
          tl.to({}, { duration: 0.04 }, PHASE.inventoryEnd - 0.04);

          tl.to(world, { x: compact ? 0 : -90, y: compact ? -8 : -10, scale: compact ? 1.1 : 1.2, duration: 0.1 }, PHASE.inventoryEnd);
          tl.to(accounting, { opacity: 1, scale: 1.04, duration: 0.08 }, PHASE.inventoryEnd);
          tl.to([sales, inventory], { opacity: 0.34, scale: 1, duration: 0.08 }, PHASE.inventoryEnd);
          tl.to({}, { duration: 0.04 }, PHASE.accountingEnd - 0.04);

          tl.to(world, { x: 0, y: 0, scale: 1, rotateX: 4, duration: 0.08 }, PHASE.accountingEnd);
          tl.to(panels, { opacity: 1, scale: 1, duration: 0.08 }, PHASE.accountingEnd);
          tl.to(understandRef.current, { opacity: 1, y: 0, duration: 0.06 }, PHASE.accountingEnd + 0.06);
          tl.to({}, { duration: 0.04 }, PHASE.understandEnd - 0.04);

          tl.to(understandRef.current, { opacity: 0, y: -16, duration: 0.04 }, PHASE.understandEnd);
          tl.to(
            dashWrap,
            { scale: compact ? 0.46 : 0.36, y: compact ? -40 : -70, rotateX: 10, duration: PHASE.hqEnd - PHASE.understandEnd },
            PHASE.understandEnd
          );
          tl.to(world, { scale: 0.92, y: 18, rotateX: 10, duration: PHASE.hqEnd - PHASE.understandEnd }, PHASE.understandEnd);
          tl.to(hqRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.06 }, PHASE.understandEnd + 0.04);

          tl.to(world, { scale: compact ? 0.78 : 0.7, y: 34, rotateX: 14, duration: PHASE.locationsEnd - PHASE.hqEnd }, PHASE.hqEnd);
          tl.to(locations, { opacity: 1, scale: 1, y: 0, stagger: 0.02, duration: 0.08 }, PHASE.hqEnd + 0.02);
          tl.to(linesRef.current, { opacity: 0.72, duration: 0.06 }, PHASE.hqEnd + 0.04);
          packets.forEach((packet, i) => {
            tl.to(packet, { opacity: 0.95, duration: 0.03 }, PHASE.hqEnd + 0.05 + i * 0.01);
            tl.to(
              packet,
              {
                motionPath: {
                  path: `#gates-scale-path-${i}`,
                  align: `#gates-scale-path-${i}`,
                  alignOrigin: [0.5, 0.5],
                },
                duration: 0.1,
              },
              PHASE.hqEnd + 0.06 + i * 0.012
            );
          });

          const storyTl = buildCompanyStoryTimeline({
            gsap,
            refs: story,
            world,
            dashWrap,
            locations,
            lines: linesRef.current,
            compact,
          });
          ScrollTrigger.create({
            trigger: section,
            start: `top+=${scaleVh}vh top`,
            end: 'bottom bottom',
            scrub: compact ? 0.55 : 0.72,
            invalidateOnRefresh: true,
            onUpdate: () => emitNavTheme('light'),
            animation: storyTl,
          });
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  const live = [
    storyCopy.liveAlexandria,
    storyCopy.liveWarehouse,
    storyCopy.liveFactory,
    storyCopy.liveRetail,
    storyCopy.liveHq,
  ];

  return (
    <section
      ref={sectionRef}
      id="product-scale"
      className="relative h-[1100vh] bg-[#f7fbfd] md:h-[1400vh]"
      aria-label={storyCopy.os2}
    >
      <div ref={stageRef} className="gates-cinematic-stage sticky top-0 h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#eef7fc_58%,#e4f1f8_100%)]" />

        <div
          ref={understandRef}
          className="absolute inset-x-[6vw] top-[14%] z-0 text-center"
        >
          <p className="font-editorial text-[clamp(2.4rem,8vw,7.2rem)] font-semibold leading-none tracking-[-0.05em] text-[#0b6fa4]/28">
            {c.understand1}
          </p>
          <p className="mt-2 font-editorial text-[clamp(1.4rem,4vw,3.4rem)] font-semibold tracking-[-0.04em] text-[#071b2b]/40">
            {c.understand2}
          </p>
        </div>

        <div className="gates-cinematic-scene absolute inset-0">
          <div ref={worldRef} className="gates-cinematic-camera relative h-full w-full">
            <div
              ref={wordRef}
              className="absolute inset-x-[4vw] top-[28%] z-30 flex justify-center gap-[0.04em] font-editorial text-[clamp(4.5rem,16vw,14rem)] font-semibold leading-[0.78] tracking-[-0.06em] text-[#0b6fa4]"
            >
              {LETTERS.map((letter) => (
                <span key={letter} className="inline-block">
                  {letter}
                </span>
              ))}
            </div>

            <div
              ref={veilRef}
              className="pointer-events-none absolute left-1/2 top-[46%] z-20 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(11,111,164,0.28) 0%, rgba(234,246,252,0) 68%)',
              }}
              aria-hidden
            />

            <div
              ref={dashWrapRef}
              className="absolute left-1/2 top-[52%] z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <ExecutiveDashboard
                copy={c}
                dashRef={(el) => {
                  dashRef.current = el;
                }}
                salesRef={(el) => {
                  salesRef.current = el;
                }}
                inventoryRef={(el) => {
                  inventoryRef.current = el;
                }}
                accountingRef={(el) => {
                  accountingRef.current = el;
                }}
              />
            </div>

            <div
              ref={hqRef}
              className="absolute left-1/2 top-[68%] z-10 -translate-x-1/2"
            >
              <LocationLiveChip
                label={live[4]}
                chipRef={(el) => {
                  storyRefs.current.live[4] = el;
                }}
              />
              <LocationPlatform
                wide
                label={c.hq}
                platformRef={() => undefined}
              />
            </div>

            <div className="absolute left-[10%] top-[24%] z-10 hidden md:block">
              <LocationLiveChip
                label={live[0]}
                chipRef={(el) => {
                  storyRefs.current.live[0] = el;
                }}
              />
              <LocationPlatform
                label={c.alexandria}
                platformRef={(el) => {
                  locRefs.current[0] = el;
                }}
              />
            </div>
            <div className="absolute left-[78%] top-[22%] z-10">
              <LocationLiveChip
                label={live[1]}
                chipRef={(el) => {
                  storyRefs.current.live[1] = el;
                }}
              />
              <LocationPlatform
                label={c.warehouse}
                platformRef={(el) => {
                  locRefs.current[1] = el;
                }}
              />
            </div>
            <div className="absolute left-[12%] top-[72%] z-10">
              <LocationLiveChip
                label={live[2]}
                chipRef={(el) => {
                  storyRefs.current.live[2] = el;
                }}
              />
              <LocationPlatform
                label={c.factory}
                platformRef={(el) => {
                  locRefs.current[2] = el;
                }}
              />
            </div>
            <div className="absolute left-[76%] top-[74%] z-10">
              <div
                ref={(el) => {
                  storyRefs.current.pulse = el;
                }}
                className="absolute left-1/2 top-[1.1rem] z-0 h-[5.5rem] w-[5.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1499d6] opacity-0"
                style={{ boxShadow: '0 0 0 10px rgba(20,153,214,0.12)' }}
                aria-hidden
              />
              <LocationLiveChip
                label={live[3]}
                chipRef={(el) => {
                  storyRefs.current.live[3] = el;
                }}
              />
              <LocationPlatform
                label={c.retail}
                platformRef={(el) => {
                  locRefs.current[3] = el;
                }}
              />
            </div>

            <svg
              ref={linesRef}
              className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
              viewBox="0 0 1000 700"
              fill="none"
              aria-hidden
            >
              <path id="gates-scale-path-0" d="M500 430 C 360 360, 220 280, 160 210" stroke="#0b6fa4" strokeWidth="1.4" strokeOpacity="0.35" />
              <path id="gates-scale-path-1" d="M500 430 C 640 340, 760 260, 820 200" stroke="#0b6fa4" strokeWidth="1.4" strokeOpacity="0.35" />
              <path id="gates-scale-path-2" d="M500 430 C 340 500, 220 540, 170 540" stroke="#0b6fa4" strokeWidth="1.4" strokeOpacity="0.35" />
              <path id="gates-scale-path-3" d="M500 430 C 680 520, 790 560, 830 560" stroke="#0b6fa4" strokeWidth="1.4" strokeOpacity="0.35" />
              {[0, 1, 2, 3].map((i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    packetsRef.current[i] = el;
                  }}
                  r="5"
                  fill="#1499d6"
                />
              ))}
            </svg>
          </div>
        </div>

        <CompanyStoryOverlay
          copy={storyCopy}
          sample={c.sample}
          locale={locale}
          refs={storyRefs.current}
        />
      </div>
    </section>
  );
}

export default ProductScaleJourney;
