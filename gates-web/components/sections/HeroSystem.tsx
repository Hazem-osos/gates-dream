'use client';

import { useLayoutEffect, useRef } from 'react';
import { HERO_MODULES, type HeroModule } from '../../data/modules';
import { emitNavTheme, HERO } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { MagneticButton } from '../animations/MagneticButton';
import { BusinessModule } from '../ui/BusinessModule';
import { GatesEngine } from '../ui/GatesEngine';

const PHASE = HERO.phases;
/** Which docked modules carry a visible data particle once connected (keep it sparse — 1-3). */
const PACKET_MODULE_IDS: HeroModule['id'][] = ['accounting', 'sales', 'projects'];

type Point = { x: number; y: number };

export function HeroSystem() {
  const { locale, copy } = useMarketingLocale();

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const moduleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const moduleFrameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const moduleNameRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const packetRefs = useRef<(SVGRectElement | null)[]>([]);

  const engineFrameRef = useRef<HTMLDivElement>(null);
  const engineCoreRef = useRef<HTMLDivElement>(null);
  const engineCoreLabelRef = useRef<HTMLDivElement>(null);
  const engineDashboardRef = useRef<HTMLDivElement>(null);
  const engineTabBarRef = useRef<HTMLDivElement>(null);
  const engineSidebarWordRef = useRef<HTMLSpanElement>(null);
  const enginePortsRef = useRef<HTMLDivElement>(null);
  const engineLabelRef = useRef<HTMLParagraphElement>(null);

  const brandRef = useRef<HTMLParagraphElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const headlineWrapRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const stage = stageRef.current;
    const field = fieldRef.current;
    const svg = svgRef.current;
    const engineFrame = engineFrameRef.current;
    const engineCore = engineCoreRef.current;
    if (!section || !stage || !field || !svg || !engineFrame || !engineCore) return;

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

          const activeModules = HERO_MODULES.filter((m) => !compact || m.mobile);
          const inactiveModules = HERO_MODULES.filter((m) => compact && !m.mobile);
          const packetModules = activeModules.filter((m) => PACKET_MODULE_IDS.includes(m.id));

          let sidebarTargets: Point[] = [];
          let coreTarget = { x: 0, y: 0, width: 200, height: 200 };
          let dashboardTarget = { x: 0, y: 0, width: 200, height: 200 };
          const dockPositions: Point[] = [];
          const startPositions: Point[] = [];

          /**
           * Measures the real Gates Engine box and every module's own rendered size, then
           * derives dock/start/rail geometry from those measurements — never hard-coded
           * percentages. That's what keeps the connection ports pixel-aligned and the
           * modules from overlapping the (narrower) engine face at every breakpoint.
           */
          const layout = () => {
            const w = field.clientWidth;
            const h = field.clientHeight;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            const fieldRect = field.getBoundingClientRect();
            const engineRect = engineFrame.getBoundingClientRect();
            const engineCenter = {
              x: engineRect.left - fieldRect.left + engineRect.width / 2,
              y: engineRect.top - fieldRect.top + engineRect.height / 2,
            };
            const engineHalf = { x: engineRect.width / 2, y: engineRect.height / 2 };
            const gap = compact ? 14 : 24;
            const offscreen = compact ? 0.64 : 0.6;

            HERO_MODULES.forEach((m, i) => {
              const el = moduleRefs.current[i];
              const path = pathRefs.current[i];
              if (!el) return;
              const mw = el.offsetWidth;
              const mh = el.offsetHeight;

              let dockX = engineCenter.x;
              let dockY = engineCenter.y;
              let engineX = engineCenter.x;
              let engineY = engineCenter.y;
              let startX = dockX;
              let startY = dockY;

              if (m.side === 'left') {
                dockY = engineCenter.y - engineHalf.y + (engineRect.height * m.edgePosition) / 100;
                dockX = engineCenter.x - engineHalf.x - gap - mw / 2;
                engineX = engineCenter.x - engineHalf.x;
                engineY = dockY;
                startX = -w * offscreen;
                startY = dockY;
              } else if (m.side === 'right') {
                dockY = engineCenter.y - engineHalf.y + (engineRect.height * m.edgePosition) / 100;
                dockX = engineCenter.x + engineHalf.x + gap + mw / 2;
                engineX = engineCenter.x + engineHalf.x;
                engineY = dockY;
                startX = w * (1 + offscreen);
                startY = dockY;
              } else if (m.side === 'top') {
                dockX = engineCenter.x;
                dockY = engineCenter.y - engineHalf.y - gap - mh / 2;
                engineX = dockX;
                engineY = engineCenter.y - engineHalf.y;
                startX = dockX;
                startY = -h * offscreen;
              } else {
                const sideOffset = gap / 2 + mw / 2;
                dockX = m.align === 'before' ? engineCenter.x - sideOffset : m.align === 'after' ? engineCenter.x + sideOffset : engineCenter.x;
                dockY = engineCenter.y + engineHalf.y + gap + mh / 2;
                engineX = dockX;
                engineY = engineCenter.y + engineHalf.y;
                startX = dockX;
                startY = h * (1 + offscreen);
              }

              dockPositions[i] = { x: dockX - w / 2, y: dockY - h / 2 };
              startPositions[i] = { x: startX - w / 2, y: startY - h / 2 };

              if (path) {
                path.setAttribute('d', `M ${dockX} ${dockY} L ${engineX} ${engineY}`);
                const length = path.getTotalLength();
                path.setAttribute('stroke-dasharray', String(length));
                path.setAttribute('stroke-dashoffset', String(length));
              }
            });

            // Dashboard-phase target geometry — the engine literally re-shapes into this.
            const dashW = Math.min(w * (compact ? 0.88 : 0.62), compact ? 560 : 960);
            const dashH = h * (compact ? 0.5 : 0.56);
            const centerX = engineCenter.x;
            const centerY = h / 2;
            dashboardTarget = {
              x: centerX - w / 2,
              y: centerY - h / 2,
              width: dashW,
              height: dashH,
            };
            const sidebarColW = Math.max(compact ? 92 : 128, dashW * 0.24);
            const frameLeftOffsetX = dashboardTarget.x - dashW / 2;
            const rows = activeModules.length;
            const rowH = (dashH - 24) / rows;
            sidebarTargets = activeModules.map((_, i) => ({
              x: frameLeftOffsetX + sidebarColW / 2,
              y: dashboardTarget.y - dashH / 2 + 12 + rowH * (i + 0.5),
            }));
            coreTarget = {
              x: dashboardTarget.x + sidebarColW / 2,
              y: dashboardTarget.y,
              width: dashW - sidebarColW - 24,
              height: dashH - 24,
            };
          };

          // The engine's own centering transform (xPercent/yPercent: -50) MUST be applied
          // before `layout()` reads its getBoundingClientRect() — otherwise the rect still
          // reflects the untransformed `left-1/2 top-1/2` box (top-left corner pinned to the
          // field's center, not the box's own center), which silently shifts every dock,
          // rail, and dashboard coordinate derived from `engineCenter` by half the engine's
          // width/height. Set it (and the field's own identity transform) first, then measure.
          gsap.set(stage, { backgroundColor: '#ffffff' });
          gsap.set(field, { xPercent: 0, yPercent: 0, x: 0, y: 0, scale: 1, rotationY: 0, rotationX: 0 });
          gsap.set(engineFrame, { xPercent: -50, yPercent: -50, x: 0, y: 0, borderColor: 'var(--gates-blue)' });
          gsap.set(engineCore, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 1 });

          layout();

          const paths = pathRefs.current.filter(Boolean) as SVGPathElement[];
          const packets = packetRefs.current.filter(Boolean) as SVGRectElement[];

          // Initial states
          gsap.set(paths, { opacity: 0 });
          gsap.set(packets, { opacity: 0 });

          activeModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            if (!el) return;
            const start = startPositions[idx];
            gsap.set(el, { xPercent: -50, yPercent: -50, x: start.x, y: start.y, scale: 1, opacity: 1 });
          });
          inactiveModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            if (el) gsap.set(el, { opacity: 0 });
          });

          gsap.set(engineTabBarRef.current, { opacity: 0 });
          gsap.set(engineDashboardRef.current, { opacity: 0 });
          gsap.set(enginePortsRef.current, { opacity: 1 });
          gsap.set(engineLabelRef.current, { opacity: 1 });

          gsap.set(brandRef.current, { opacity: 0, scale: 1 });
          gsap.set([eyebrowRef.current, headlineWrapRef.current, supportRef.current, ctaRef.current], {
            opacity: 1,
            y: 0,
          });
          gsap.set(wipeRef.current, { scaleY: 0, transformOrigin: '50% 100%', backgroundColor: 'var(--gates-blue-dark)' });
          emitNavTheme('light');

          if (reduced) {
            activeModules.forEach((m) => {
              const idx = HERO_MODULES.indexOf(m);
              const el = moduleRefs.current[idx];
              if (!el) return;
              const dock = dockPositions[idx];
              gsap.set(el, { x: dock.x, y: dock.y });
            });
            gsap.set(paths, { opacity: 0.4, attr: { 'stroke-dashoffset': 0 } });
            gsap.set(engineFrame, { borderColor: 'var(--gates-blue)' });
            gsap.set(supportRef.current, { opacity: 1 });
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.5,
              invalidateOnRefresh: true,
              onRefresh: layout,
              onUpdate: (self) => emitNavTheme(self.progress >= 0.88 ? 'dark' : 'light'),
            },
          });

          // ---- 0–12%: hold. Headline + inactive engine outline own the frame. ----
          tl.to([supportRef.current, ctaRef.current], { opacity: 0, y: -14, duration: 0.05 }, PHASE.stillEnd);

          // ---- 12–63%: modules travel a straight mechanical rail and dock, one turn at a time. ----
          activeModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            const frameEl = moduleFrameRefs.current[idx];
            const path = pathRefs.current[idx];
            if (!el) return;
            const dock = dockPositions[idx];
            const dur = m.phase.end - m.phase.start;
            const t0 = m.phase.start;

            tl.to(el, { x: dock.x, y: dock.y, duration: dur * 0.78, ease: 'power2.inOut' }, t0);
            // impact: compression + snap-back — the "physical" dock reaction.
            tl.to(el, { scale: 0.9, duration: dur * 0.06 }, t0 + dur * 0.78);
            tl.to(el, { scale: 1, duration: dur * 0.16, ease: 'back.out(2.6)' }, t0 + dur * 0.84);
            if (frameEl) {
              tl.to(frameEl, { backgroundColor: 'var(--gates-blue)', duration: dur * 0.06 }, t0 + dur * 0.78);
              tl.to(frameEl, { backgroundColor: 'var(--gates-white)', duration: dur * 0.22 }, t0 + dur * 0.84);
            }
            if (path) {
              tl.to(path, { opacity: 0.55, duration: dur * 0.05 }, t0 + dur * 0.62);
              tl.to(
                path,
                { attr: { 'stroke-dashoffset': 0 }, duration: dur * 0.3, ease: 'power2.inOut' },
                t0 + dur * 0.62
              );
            }
            if (PACKET_MODULE_IDS.includes(m.id) && path) {
              const packetIdx = packetModules.findIndex((pm) => pm.id === m.id);
              const packet = packets[packetIdx];
              if (packet) {
                tl.to(packet, { opacity: 1, duration: 0.015 }, t0 + dur * 0.66);
                tl.to(
                  packet,
                  {
                    motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false },
                    duration: dur * 0.26,
                    ease: 'none',
                  },
                  t0 + dur * 0.66
                );
                tl.to(packet, { opacity: 0, duration: 0.02 }, t0 + dur * 0.92);
              }
            }
          });

          // Subtle composition shift as Inventory docks from the right.
          const inventoryPhase = HERO_MODULES.find((m) => m.id === 'inventory')?.phase.start ?? 0.25;
          tl.to(field, { x: compact ? -6 : -16, scale: compact ? 1.01 : 1.02, duration: 0.03, ease: 'power2.inOut' }, inventoryPhase);

          // ---- 63–72%: modules compress toward the core — one connected machine. ----
          const compressDur = PHASE.compressEnd - PHASE.dockEnd;
          activeModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            if (!el) return;
            const dock = dockPositions[idx];
            tl.to(
              el,
              { x: dock.x * 0.52, y: dock.y * 0.52, scale: compact ? 0.82 : 0.86, duration: compressDur, ease: 'power2.inOut' },
              PHASE.dockEnd
            );
          });
          tl.to(paths, { opacity: 0, duration: compressDur * 0.6 }, PHASE.dockEnd);
          tl.to(engineCore, { scale: 1.12, duration: compressDur, ease: 'power2.inOut' }, PHASE.dockEnd);
          tl.to(
            engineFrame,
            { boxShadow: '0 0 46px -6px rgba(14,121,170,0.45)', duration: compressDur * 0.4 },
            PHASE.dockEnd
          );
          tl.to(headlineWrapRef.current, { y: -34, opacity: 0, duration: compressDur, ease: 'power2.in' }, PHASE.dockEnd);
          tl.to(eyebrowRef.current, { opacity: 0, duration: compressDur * 0.5 }, PHASE.dockEnd);

          // ---- 72–82%: 2.5D rotate/scale — the GATES word is revealed behind the machine. ----
          const rotateDur = PHASE.rotateEnd - PHASE.compressEnd;
          tl.to(
            field,
            {
              rotationY: compact ? 5 : 9,
              rotationX: compact ? -2 : -4,
              scale: compact ? 1.05 : 1.09,
              duration: rotateDur,
              ease: 'power2.inOut',
            },
            PHASE.compressEnd
          );
          tl.to(brandRef.current, { opacity: compact ? 0.1 : 0.14, scale: compact ? 1.04 : 1.08, duration: rotateDur }, PHASE.compressEnd);

          // ---- 82–92%: the machine becomes the browser-like ERP interface. ----
          const dashDur = PHASE.dashboardEnd - PHASE.rotateEnd;
          tl.to(
            field,
            { rotationY: 0, rotationX: 0, x: 0, scale: compact ? 1.03 : 1.05, duration: dashDur * 0.45, ease: 'power2.inOut' },
            PHASE.rotateEnd
          );
          tl.to(brandRef.current, { opacity: 0, duration: dashDur * 0.3 }, PHASE.rotateEnd);
          tl.to(
            engineFrame,
            {
              width: dashboardTarget.width,
              height: dashboardTarget.height,
              x: dashboardTarget.x,
              y: dashboardTarget.y,
              duration: dashDur,
              ease: 'power2.inOut',
            },
            PHASE.rotateEnd
          );
          tl.to(enginePortsRef.current, { opacity: 0, duration: dashDur * 0.3 }, PHASE.rotateEnd);
          tl.to(engineLabelRef.current, { opacity: 0, duration: dashDur * 0.25 }, PHASE.rotateEnd);
          tl.to(engineTabBarRef.current, { opacity: 1, duration: dashDur * 0.3 }, PHASE.rotateEnd + dashDur * 0.4);

          activeModules.forEach((m, i) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            const nameEl = moduleNameRefs.current[idx];
            if (!el) return;
            const target = sidebarTargets[i];
            tl.to(
              el,
              {
                x: target.x,
                y: target.y,
                scale: compact ? 0.58 : 0.64,
                duration: dashDur,
                ease: 'power2.inOut',
              },
              PHASE.rotateEnd
            );
            if (nameEl) {
              tl.to(nameEl, { opacity: 0.85, duration: dashDur * 0.4 }, PHASE.rotateEnd + dashDur * 0.5);
            }
          });

          tl.to(
            engineCore,
            {
              width: coreTarget.width,
              height: coreTarget.height,
              x: coreTarget.x,
              y: coreTarget.y,
              scale: 1,
              duration: dashDur,
              ease: 'power2.inOut',
            },
            PHASE.rotateEnd
          );
          tl.to(engineCoreLabelRef.current, { opacity: 0, duration: dashDur * 0.25 }, PHASE.rotateEnd);
          tl.to(engineDashboardRef.current, { opacity: 1, duration: dashDur * 0.4 }, PHASE.rotateEnd + dashDur * 0.5);

          // ---- 92–100%: interface expands toward the viewer; background turns Gates Blue. ----
          const finalDur = PHASE.finish - PHASE.dashboardEnd;
          tl.to(stage, { backgroundColor: 'var(--gates-blue)', duration: finalDur * 0.55 }, PHASE.dashboardEnd);
          tl.to(field, { scale: compact ? 1.1 : 1.16, duration: finalDur, ease: 'power2.in' }, PHASE.dashboardEnd);
          tl.to(wipeRef.current, { scaleY: 1, duration: finalDur * 0.75, ease: 'power3.inOut' }, PHASE.dashboardEnd + finalDur * 0.2);
        }
      );
    }, section);

    return () => {
      ctx.revert();
      emitNavTheme('light');
    };
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="gates-system"
      className="relative h-[210vh] md:h-[400vh]"
      aria-label={copy.hero.headlineLine1}
    >
      <div ref={stageRef} className="gates-hero-stage sticky top-0 h-[100svh] overflow-hidden bg-white">
        <div className="gates-tech-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />

        <p
          ref={brandRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[18%] text-center text-[clamp(6rem,20vw,17rem)] font-bold leading-[0.78] tracking-[-0.04em] text-[var(--gates-blue)]"
        >
          {copy.wordmark}
        </p>

        <div className="absolute inset-0" style={{ perspective: '1700px' }}>
          <div ref={fieldRef} className="relative h-full w-full" style={{ transformStyle: 'flat' }}>
            <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {HERO_MODULES.map((mod, i) => (
                <path
                  key={mod.id}
                  ref={(el) => {
                    pathRefs.current[i] = el;
                  }}
                  fill="none"
                  stroke="var(--gates-blue)"
                  strokeWidth="1.25"
                />
              ))}
              {PACKET_MODULE_IDS.map((id) => (
                <rect
                  key={`pkt-${id}`}
                  ref={(el) => {
                    const idx = HERO_MODULES.filter((m) => PACKET_MODULE_IDS.includes(m.id)).findIndex(
                      (m) => m.id === id
                    );
                    packetRefs.current[idx] = el;
                  }}
                  width="5"
                  height="5"
                  fill="var(--gates-blue-light)"
                />
              ))}
            </svg>

            {HERO_MODULES.map((mod, i) => (
              <BusinessModule
                key={mod.id}
                number={mod.index}
                name={mod.label[locale]}
                side={mod.side}
                cardRef={(el) => {
                  moduleRefs.current[i] = el;
                }}
                frameRef={(el) => {
                  moduleFrameRefs.current[i] = el;
                }}
                nameRef={(el) => {
                  moduleNameRefs.current[i] = el;
                }}
              />
            ))}

            <GatesEngine
              label={copy.hero.core}
              frameRef={(el) => {
                engineFrameRef.current = el;
              }}
              coreRef={(el) => {
                engineCoreRef.current = el;
              }}
              coreLabelRef={(el) => {
                engineCoreLabelRef.current = el;
              }}
              dashboardRef={(el) => {
                engineDashboardRef.current = el;
              }}
              tabBarRef={(el) => {
                engineTabBarRef.current = el;
              }}
              sidebarWordRef={(el) => {
                engineSidebarWordRef.current = el;
              }}
              portsRef={(el) => {
                enginePortsRef.current = el;
              }}
              engineLabelRef={(el) => {
                engineLabelRef.current = el;
              }}
            />
          </div>
        </div>

        <div className="relative z-30 flex h-full flex-col justify-between px-5 pb-8 pt-24 md:px-12 md:pb-12 md:pt-28">
          <div ref={headlineWrapRef} className="max-w-[19rem] md:max-w-[30rem]">
            <p
              ref={eyebrowRef}
              className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-[var(--gates-blue)]"
            >
              {copy.hero.eyebrow}
            </p>
            <h1 className="mt-6 text-[clamp(2.4rem,6.2vw,5.75rem)] font-semibold leading-[0.94] tracking-[-0.01em] text-[var(--gates-navy)]">
              <span className="block">{copy.hero.headlineLine1}</span>
              <span className="block">{copy.hero.headlineLine2}</span>
            </h1>
          </div>

          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p ref={supportRef} className="max-w-sm text-[0.88rem] leading-relaxed text-[var(--gates-navy)]/55 md:text-[1.02rem]">
              {copy.hero.support}
            </p>
            <div ref={ctaRef} className="flex flex-wrap gap-3">
              <MagneticButton href="/login" variant="brand">
                {copy.hero.demo}
              </MagneticButton>
              <MagneticButton href="#product" variant="brand-ghost">
                {copy.hero.explore}
              </MagneticButton>
            </div>
          </div>
        </div>

        <div
          ref={wipeRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 origin-bottom"
        />
      </div>
    </section>
  );
}
