'use client';

import { useLayoutEffect, useRef } from 'react';
import { OPENING, emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import {
  AccountingSurface,
  InventorySurface,
  ModuleTile,
  SalesOrderObject,
  SalesSurface,
} from './opening-surfaces';

const PHASE = OPENING.phases;

export function OpeningJourney() {
  const { copy, locale } = useMarketingLocale();
  const c = copy.opening;

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const salesRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLSpanElement>(null);
  const stockNoteRef = useRef<HTMLParagraphElement>(null);
  const accountingRef = useRef<HTMLDivElement>(null);
  const revenueRef = useRef<HTMLDivElement>(null);
  const receivableRef = useRef<HTMLDivElement>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const wordOneRef = useRef<HTMLParagraphElement>(null);
  const wordReactRef = useRef<HTMLParagraphElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const stage = stageRef.current;
    const camera = cameraRef.current;
    const invoice = invoiceRef.current;
    const sales = salesRef.current;
    const inventory = inventoryRef.current;
    const accounting = accountingRef.current;
    const pulse = pulseRef.current;
    if (!section || !stage || !camera || !invoice || !sales || !inventory || !accounting || !pulse) {
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
          const tiles = tileRefs.current.filter(Boolean) as HTMLDivElement[];
          const stockState = { n: 124 };

          const setIntro = () => {
            gsap.set(camera, { x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0, force3D: true });
            gsap.set(invoice, { x: 0, y: 0, scale: 1, rotateX: 14, rotateY: compact ? 0 : -9, force3D: true });
            gsap.set(sales, { opacity: 0, scale: 0.78, rotateX: 18, force3D: true });
            gsap.set([amountRef.current, statusRef.current], { opacity: 0, y: 18 });
            gsap.set(inventory, { opacity: 0, x: compact ? 0 : 160, y: compact ? 80 : 0, scale: 0.94, force3D: true });
            gsap.set(accounting, { opacity: 0, x: compact ? 0 : 180, y: compact ? 80 : 0, scale: 0.94, force3D: true });
            gsap.set([revenueRef.current, receivableRef.current, ledgerRef.current, stockNoteRef.current], {
              opacity: 0,
              y: 16,
            });
            gsap.set(pulse, { opacity: 0, scale: 0.35, x: 0, y: 0, force3D: true });
            gsap.set(headlineRef.current, { opacity: 1, y: 0 });
            gsap.set([wordOneRef.current, wordReactRef.current], { opacity: 0, y: 28 });
            gsap.set(floorRef.current, { opacity: 0, scale: 0.86 });
            gsap.set(tiles, { opacity: 0, scale: 0.86, y: 24, force3D: true });
            stockState.n = 124;
            if (stockRef.current) stockRef.current.textContent = '124';
          };

          const setFinale = () => {
            gsap.set(headlineRef.current, { opacity: 0, y: -24 });
            gsap.set(sales, { opacity: 1, scale: 1, rotateX: 4 });
            gsap.set(invoice, { scale: compact ? 0.42 : 0.5, rotateX: 4, rotateY: 0 });
            gsap.set([amountRef.current, statusRef.current], { opacity: 1, y: 0 });
            gsap.set(inventory, { opacity: 1, x: 0, y: 0, scale: 1 });
            gsap.set(accounting, { opacity: 1, x: 0, y: 0, scale: 1 });
            gsap.set([revenueRef.current, receivableRef.current, ledgerRef.current, stockNoteRef.current], {
              opacity: 1,
              y: 0,
            });
            gsap.set(camera, {
              x: compact ? 0 : -220,
              y: compact ? -210 : 36,
              scale: compact ? 0.58 : 0.46,
              rotateX: 18,
            });
            gsap.set(tiles, { opacity: 1, scale: 1, y: 0 });
            gsap.set([wordOneRef.current, wordReactRef.current], { opacity: 1, y: 0 });
            gsap.set(floorRef.current, { opacity: 0.7, scale: 1 });
            gsap.set(pulse, { opacity: 0 });
            stockState.n = 123;
            if (stockRef.current) stockRef.current.textContent = '123';
          };

          setIntro();
          emitNavTheme('light');

          if (reduced) {
            setFinale();
            return;
          }

          const dockX = compact ? 0 : -176;
          const dockY = compact ? -72 : 8;
          const panInvX = compact ? 0 : -Math.min(stage.clientWidth * 0.32, 400);
          const panInvY = compact ? -260 : 0;
          const panAccX = compact ? 0 : -Math.min(stage.clientWidth * 0.66, 840);
          const panAccY = compact ? -520 : 0;
          const panRevealX = compact ? 0 : -Math.min(stage.clientWidth * 0.28, 360);
          const panRevealY = compact ? -210 : 40;

          const tl = gsap.timeline({
            defaults: { ease: 'none', force3D: true },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.55 : 0.72,
              invalidateOnRefresh: true,
              onUpdate: () => emitNavTheme('light'),
            },
          });

          tl.to({}, { duration: PHASE.introEnd }, 0);

          tl.to(headlineRef.current, { opacity: 0, y: -36, duration: 0.06 }, PHASE.introEnd);
          tl.to(sales, { opacity: 1, scale: 1, rotateX: 4, duration: 0.1 }, PHASE.introEnd);
          tl.to(
            invoice,
            {
              duration: 0.12,
              x: dockX,
              y: dockY,
              rotateX: 3,
              rotateY: 0,
              scale: compact ? 0.42 : 0.5,
            },
            PHASE.introEnd
          );
          tl.to(amountRef.current, { opacity: 1, y: 0, duration: 0.05 }, PHASE.introEnd + 0.12);
          tl.to(statusRef.current, { opacity: 1, y: 0, duration: 0.04 }, PHASE.introEnd + 0.15);
          tl.to(pulse, { opacity: 1, scale: 1, duration: 0.05 }, PHASE.introEnd + 0.16);
          tl.to({}, { duration: 0.05 }, PHASE.saleEnd - 0.05);

          tl.to(camera, { x: panInvX, y: panInvY, duration: PHASE.inventoryEnd - PHASE.saleEnd - 0.06 }, PHASE.saleEnd);
          tl.to(pulse, { x: compact ? 0 : 300, y: compact ? 240 : 6, duration: 0.1 }, PHASE.saleEnd);
          tl.to(inventory, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.1 }, PHASE.saleEnd + 0.02);
          tl.to(
            stockState,
            {
              n: 123,
              duration: 0.07,
              snap: { n: 1 },
              onUpdate: () => {
                if (stockRef.current) stockRef.current.textContent = String(stockState.n);
              },
            },
            PHASE.saleEnd + 0.12
          );
          tl.to(stockNoteRef.current, { opacity: 1, y: 0, duration: 0.04 }, PHASE.saleEnd + 0.16);
          tl.to({}, { duration: 0.04 }, PHASE.inventoryEnd - 0.04);

          tl.to(
            camera,
            { x: panAccX, y: panAccY, duration: PHASE.accountingEnd - PHASE.inventoryEnd - 0.06 },
            PHASE.inventoryEnd
          );
          tl.to(pulse, { x: compact ? 0 : 590, y: compact ? 460 : 10, duration: 0.1 }, PHASE.inventoryEnd);
          tl.to(accounting, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.1 }, PHASE.inventoryEnd + 0.02);
          tl.to(revenueRef.current, { opacity: 1, y: 0, duration: 0.045 }, PHASE.inventoryEnd + 0.1);
          tl.to(receivableRef.current, { opacity: 1, y: 0, duration: 0.045 }, PHASE.inventoryEnd + 0.13);
          tl.to(ledgerRef.current, { opacity: 1, y: 0, duration: 0.06 }, PHASE.inventoryEnd + 0.15);
          tl.to({}, { duration: 0.04 }, PHASE.accountingEnd - 0.04);

          tl.to(
            camera,
            {
              x: panRevealX,
              y: panRevealY,
              scale: compact ? 0.6 : 0.46,
              rotateX: 18,
              duration: 0.14,
            },
            PHASE.accountingEnd
          );
          tl.to(pulse, { opacity: 0, scale: 1.35, duration: 0.06 }, PHASE.accountingEnd);
          tl.to(floorRef.current, { opacity: 0.72, scale: 1, duration: 0.12 }, PHASE.accountingEnd + 0.02);
          tl.to(tiles, { opacity: 1, scale: 1, y: 0, stagger: 0.018, duration: 0.1 }, PHASE.accountingEnd + 0.06);
          tl.to(wordOneRef.current, { opacity: 1, y: 0, duration: 0.06 }, PHASE.accountingEnd + 0.14);
          tl.to(wordReactRef.current, { opacity: 1, y: 0, duration: 0.07 }, PHASE.accountingEnd + 0.18);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="opening"
      className="relative bg-[#f7fbfd] h-[680vh] md:h-[860vh]"
      aria-label={`${c.headlineLine1} ${c.headlineLine2}`}
    >
      <div ref={stageRef} className="gates-cinematic-stage sticky top-0 h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#eef7fc_58%,#e4f1f8_100%)]" />

        <div
          ref={headlineRef}
          className="absolute inset-x-[6vw] top-[18vh] z-20 text-center md:top-[16vh]"
        >
          <h1 className="font-editorial text-[clamp(2.6rem,7vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-[#071b2b]">
            {c.headlineLine1}
            <br />
            {c.headlineLine2}
          </h1>
        </div>

        <div className="absolute inset-x-[6vw] top-[18%] z-0 text-center">
          <p
            ref={wordOneRef}
            className="font-editorial text-[clamp(2.8rem,9vw,8.5rem)] font-semibold leading-none tracking-[-0.05em] text-[#0b6fa4]/30"
          >
            {c.oneAction}
          </p>
          <p
            ref={wordReactRef}
            className="mt-2 font-editorial text-[clamp(1.6rem,5vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[#071b2b]/40"
          >
            {c.entireReacts}
          </p>
        </div>

        <div className="gates-cinematic-scene absolute inset-0">
          <div ref={cameraRef} className="gates-cinematic-camera relative h-full w-full">
            <div
              ref={floorRef}
              className="absolute left-1/2 top-[62%] h-[28vh] w-[120vw] -translate-x-1/2 rounded-[100%] bg-[#0b6fa4]/[0.06]"
            />

            <div
              className="absolute left-1/2 top-[54%] z-20 -translate-x-1/2 -translate-y-1/2 md:top-[56%]"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <SalesSurface
                copy={c}
                surfaceRef={(el) => {
                  salesRef.current = el;
                }}
                amountRef={(el) => {
                  amountRef.current = el;
                }}
                statusRef={(el) => {
                  statusRef.current = el;
                }}
                dockRef={(el) => {
                  dockRef.current = el;
                }}
              />
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <SalesOrderObject
                  copy={c}
                  cardRef={(el) => {
                    invoiceRef.current = el;
                  }}
                />
              </div>
            </div>

            <div className="absolute left-1/2 top-[118%] z-10 -translate-x-1/2 md:left-[72%] md:top-[54%] md:translate-x-0 md:-translate-y-1/2">
              <InventorySurface
                copy={c}
                surfaceRef={(el) => {
                  inventoryRef.current = el;
                }}
                stockRef={(el) => {
                  stockRef.current = el;
                }}
                noteRef={(el) => {
                  stockNoteRef.current = el;
                }}
              />
            </div>

            <div className="absolute left-1/2 top-[188%] z-10 -translate-x-1/2 md:left-[108%] md:top-[54%] md:translate-x-0 md:-translate-y-1/2">
              <AccountingSurface
                copy={c}
                surfaceRef={(el) => {
                  accountingRef.current = el;
                }}
                revenueRef={(el) => {
                  revenueRef.current = el;
                }}
                receivableRef={(el) => {
                  receivableRef.current = el;
                }}
                ledgerRef={(el) => {
                  ledgerRef.current = el;
                }}
              />
            </div>

            <div className="absolute left-[8%] top-[18%] hidden md:block">
              <ModuleTile
                label={c.modules.crm}
                tileRef={(el) => {
                  tileRefs.current[0] = el;
                }}
              />
            </div>
            <div className="absolute left-[28%] top-[12%] hidden md:block">
              <ModuleTile
                label={c.modules.hr}
                tileRef={(el) => {
                  tileRefs.current[1] = el;
                }}
              />
            </div>
            <div className="absolute left-[88%] top-[16%]">
              <ModuleTile
                label={c.modules.manufacturing}
                tileRef={(el) => {
                  tileRefs.current[2] = el;
                }}
              />
            </div>
            <div className="absolute left-[102%] top-[72%]">
              <ModuleTile
                label={c.modules.projects}
                tileRef={(el) => {
                  tileRefs.current[3] = el;
                }}
              />
            </div>

            <div
              ref={pulseRef}
              className="pointer-events-none absolute left-1/2 top-[54%] z-40 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(20,153,214,0.55) 0%, rgba(11,111,164,0) 70%)',
              }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default OpeningJourney;
