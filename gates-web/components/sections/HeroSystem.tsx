'use client';

import { useLayoutEffect, useRef } from 'react';
import { HERO_MODULES, type HeroModuleId } from '../../data/modules';
import { emitNavTheme, HERO } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { MagneticButton } from '../animations/MagneticButton';
import { ModulePanel } from '../ui/ModulePanel';
import { ProductDashboard } from '../ui/ProductDashboard';

const PHASE = HERO.phases;
const PACKET_IDS: HeroModuleId[] = ['accounting', 'sales', 'projects'];
const INTRO_IDS: HeroModuleId[] = ['accounting', 'inventory', 'sales'];

type Offset = { x: number; y: number; rotateX: number; rotateY: number };

function panelMotion(id: HeroModuleId, w: number, h: number, compact: boolean): { from: Offset; dock: Offset } {
  const sx = compact ? 0.28 : 0.36;
  const sy = compact ? 0.24 : 0.3;
  const map: Record<HeroModuleId, { from: Offset; dock: Offset }> = {
    accounting: {
      from: { x: -w * sx, y: -h * sy, rotateX: 8, rotateY: -18 },
      dock: { x: -w * 0.2, y: -h * 0.16, rotateX: 2, rotateY: -6 },
    },
    inventory: {
      from: { x: -w * sx, y: h * sy, rotateX: -6, rotateY: -14 },
      dock: { x: -w * 0.18, y: h * 0.15, rotateX: -2, rotateY: -5 },
    },
    sales: {
      from: { x: 0, y: h * (sy + 0.06), rotateX: -10, rotateY: 0 },
      dock: { x: 0, y: h * 0.18, rotateX: -3, rotateY: 0 },
    },
    crm: {
      from: { x: w * sx, y: -h * sy, rotateX: 6, rotateY: 16 },
      dock: { x: w * 0.18, y: -h * 0.14, rotateX: 2, rotateY: 6 },
    },
    hr: {
      from: { x: -w * (sx + 0.06), y: 0, rotateX: 0, rotateY: -16 },
      dock: { x: -w * 0.24, y: 0, rotateX: 0, rotateY: -5 },
    },
    manufacturing: {
      from: { x: w * sx, y: h * sy, rotateX: -6, rotateY: 14 },
      dock: { x: w * 0.2, y: h * 0.13, rotateX: -2, rotateY: 5 },
    },
    projects: {
      from: { x: w * 0.04, y: -h * (sy + 0.05), rotateX: 12, rotateY: 3 },
      dock: { x: w * 0.04, y: -h * 0.2, rotateX: 3, rotateY: 1 },
    },
  };
  return map[id];
}

export function HeroSystem() {
  const { locale, copy } = useMarketingLocale();

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const planesRef = useRef<HTMLDivElement>(null);
  const dashboardWrapRef = useRef<HTMLDivElement>(null);
  const moduleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const packetRefs = useRef<(SVGCircleElement | null)[]>([]);
  const particleRefs = useRef<(HTMLSpanElement | null)[]>([]);
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
    const core = coreRef.current;
    if (!section || !stage || !field || !svg || !core) return;

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
          const packetModules = activeModules.filter((m) => PACKET_IDS.includes(m.id));
          const fromMap: Offset[] = [];
          const dockMap: Offset[] = [];

          const layout = () => {
            const w = field.clientWidth;
            const h = field.clientHeight;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            const cx = w / 2;
            const cy = h / 2;

            HERO_MODULES.forEach((m, i) => {
              const motion = panelMotion(m.id, w, h, compact);
              fromMap[i] = motion.from;
              dockMap[i] = motion.dock;
              const path = pathRefs.current[i];
              if (!path) return;
              const x2 = cx + motion.dock.x;
              const y2 = cy + motion.dock.y;
              path.setAttribute('d', `M ${cx} ${cy} Q ${(cx + x2) / 2} ${cy - 24} ${x2} ${y2}`);
              const length = path.getTotalLength();
              path.setAttribute('stroke-dasharray', String(length));
              path.setAttribute('stroke-dashoffset', String(length));
            });
          };

          gsap.set(stage, { backgroundColor: '#ffffff' });
          gsap.set(field, { x: 0, y: 0, scale: 1, rotationY: 0, rotationX: 0 });
          layout();

          const paths = pathRefs.current.filter(Boolean) as SVGPathElement[];
          const packets = packetRefs.current.filter(Boolean) as SVGCircleElement[];
          const particles = particleRefs.current.filter(Boolean) as HTMLSpanElement[];

          gsap.set(paths, { opacity: 0 });
          gsap.set(packets, { opacity: 0 });
          gsap.set(particles, { opacity: 0.35, scale: 0.8 });
          gsap.set(core, { opacity: 1, scale: 0.92, rotateX: 10, rotateY: -8 });
          gsap.set(planesRef.current, { opacity: 0.9, y: 12 });
          gsap.set(dashboardWrapRef.current, { opacity: 0, scale: 0.88, y: 28 });
          gsap.set([eyebrowRef.current, headlineWrapRef.current, supportRef.current, ctaRef.current], {
            opacity: 1,
            y: 0,
          });
          gsap.set(wipeRef.current, { opacity: 0, clipPath: 'circle(0% at 38% 55%)' });
          emitNavTheme('light');

          activeModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            const from = fromMap[idx];
            if (!el || !from) return;
            const intro = INTRO_IDS.includes(m.id);
            gsap.set(el, {
              xPercent: -50,
              yPercent: -50,
              x: from.x * (intro ? 0.55 : 1),
              y: from.y * (intro ? 0.55 : 1),
              rotateX: from.rotateX,
              rotateY: from.rotateY,
              opacity: intro ? 1 : 0,
              scale: intro ? 1 : 0.9,
            });
          });
          inactiveModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            if (el) gsap.set(el, { opacity: 0 });
          });

          if (reduced) {
            activeModules.forEach((m) => {
              const idx = HERO_MODULES.indexOf(m);
              const el = moduleRefs.current[idx];
              const dock = dockMap[idx];
              if (!el || !dock) return;
              gsap.set(el, { x: dock.x, y: dock.y, opacity: 1, rotateX: 0, rotateY: 0, scale: 1 });
            });
            gsap.set(core, { opacity: 1, scale: 1, rotateX: 0, rotateY: 0 });
            gsap.set(dashboardWrapRef.current, { opacity: 1, scale: 1, y: 0 });
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.35 : 0.5,
              invalidateOnRefresh: true,
              onRefresh: layout,
              onUpdate: (self) => emitNavTheme(self.progress >= 0.9 ? 'dark' : 'light'),
            },
          });

          tl.to(particles, { opacity: 0.8, scale: 1, duration: PHASE.stillEnd, stagger: 0.015 }, 0);
          tl.to(core, { scale: 1, rotateX: 6, rotateY: -4, duration: PHASE.stillEnd }, 0);
          tl.to(planesRef.current, { y: 0, duration: PHASE.stillEnd }, 0);

          tl.to([supportRef.current, ctaRef.current], { opacity: 0, y: -18, duration: 0.05 }, PHASE.stillEnd);

          activeModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            const from = fromMap[idx];
            if (!el || !from) return;
            const dur = m.phase.end - m.phase.start;
            tl.to(
              el,
              {
                opacity: 1,
                scale: 1,
                x: from.x * 0.7,
                y: from.y * 0.7,
                duration: dur,
              },
              m.phase.start
            );
          });

          const assembleDur = PHASE.compressEnd - PHASE.dockEnd;
          activeModules.forEach((m) => {
            const idx = HERO_MODULES.indexOf(m);
            const el = moduleRefs.current[idx];
            const dock = dockMap[idx];
            if (!el || !dock) return;
            tl.to(
              el,
              {
                x: dock.x,
                y: dock.y,
                rotateX: dock.rotateX,
                rotateY: dock.rotateY,
                scale: compact ? 0.9 : 0.94,
                duration: assembleDur,
              },
              PHASE.dockEnd
            );
          });

          tl.to(paths, { opacity: 0.75, duration: assembleDur * 0.2 }, PHASE.dockEnd);
          paths.forEach((path, i) => {
            tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: assembleDur * 0.65 }, PHASE.dockEnd + i * 0.015);
          });
          packetModules.forEach((m, packetIdx) => {
            const idx = HERO_MODULES.indexOf(m);
            const path = pathRefs.current[idx];
            const packet = packets[packetIdx];
            if (!path || !packet) return;
            tl.to(packet, { opacity: 1, duration: 0.03 }, PHASE.dockEnd + 0.16);
            tl.to(
              packet,
              {
                motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
                duration: assembleDur * 0.5,
              },
              PHASE.dockEnd + 0.18
            );
            tl.to(packet, { opacity: 0, duration: 0.05 }, PHASE.dockEnd + assembleDur * 0.72);
          });

          tl.to(core, { scale: 1.06, rotateX: 2, rotateY: -2, duration: assembleDur }, PHASE.dockEnd);
          tl.to(eyebrowRef.current, { opacity: 0, duration: assembleDur * 0.4 }, PHASE.dockEnd);
          tl.to(headlineWrapRef.current, { opacity: 0, y: -36, duration: assembleDur }, PHASE.dockEnd);

          const dashDur = PHASE.dashboardEnd - PHASE.compressEnd;
          const assembledEls = activeModules
            .map((m) => moduleRefs.current[HERO_MODULES.indexOf(m)])
            .filter((el): el is HTMLDivElement => Boolean(el));
          tl.to(assembledEls, { opacity: 0, scale: 0.78, duration: dashDur * 0.2 }, PHASE.compressEnd);
          tl.to(paths, { opacity: 0, duration: dashDur * 0.12 }, PHASE.compressEnd);
          tl.to(core, { opacity: 0, scale: 1.1, duration: dashDur * 0.2 }, PHASE.compressEnd);
          tl.to(planesRef.current, { opacity: 0, duration: dashDur * 0.16 }, PHASE.compressEnd);
          tl.to(particles, { opacity: 0, duration: dashDur * 0.1 }, PHASE.compressEnd);
          tl.to(dashboardWrapRef.current, { opacity: 1, scale: 1, y: 0, duration: dashDur * 0.28 }, PHASE.compressEnd);
          tl.to(stage, { backgroundColor: '#f7fbfd', duration: dashDur * 0.18 }, PHASE.compressEnd);
          tl.to(field, { scale: compact ? 1.02 : 1.04, duration: dashDur * 0.4 }, PHASE.compressEnd + dashDur * 0.3);

          const finalDur = PHASE.finish - PHASE.dashboardEnd;
          tl.to(dashboardWrapRef.current, { scale: compact ? 1.08 : 1.14, duration: finalDur }, PHASE.dashboardEnd);
          tl.to(stage, { backgroundColor: '#061826', duration: finalDur * 0.55 }, PHASE.dashboardEnd);
          tl.to(wipeRef.current, { opacity: 1, clipPath: 'circle(140% at 38% 55%)', duration: finalDur }, PHASE.dashboardEnd);
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
      className="relative h-[280vh] md:h-[420vh]"
      aria-label={copy.hero.headlineLine1}
    >
      <div ref={stageRef} className="gates-hero-stage sticky top-0 h-[100svh] overflow-hidden bg-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 28% 48%, rgba(20,153,214,0.14), transparent 52%)' }}
          aria-hidden
        />

        <div
          className="relative mx-4 mt-4 h-[46vh] md:absolute md:inset-x-auto md:mx-0 md:mt-0 md:h-auto md:bottom-[8%] md:end-[-2%] md:start-[32%] md:top-[8%]"
          style={{ perspective: '1800px' }}
        >
          <div ref={fieldRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {['16%', '30%', '48%', '64%', '78%'].map((top, i) => (
              <span
                key={i}
                ref={(el) => {
                  particleRefs.current[i] = el;
                }}
                className="absolute h-1.5 w-1.5 rounded-full bg-[#1499d6]"
                style={{ top, insetInlineStart: `${12 + i * 16}%` }}
              />
            ))}

            <div
              ref={planesRef}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[84%] w-[90%] -translate-x-1/2 -translate-y-1/2"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div
                className="absolute inset-0 rounded-[28px] bg-[#0b6fa4]/20"
                style={{ transform: 'translateZ(-80px) rotateX(14deg)' }}
              />
              <div
                className="absolute inset-[5%] rounded-[24px] bg-[#eaf6fc]"
                style={{ transform: 'translateZ(-32px) rotateX(9deg)' }}
              />
            </div>

            <div
              ref={coreRef}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[min(68%,28rem)] w-[min(88%,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] bg-[#071b2b] text-white shadow-[0_32px_90px_rgba(11,111,164,0.34)]"
            >
              <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
                <span className="text-[0.72rem] font-semibold tracking-[0.2em] text-[#1499d6]">GATES</span>
                <span className="text-[0.62rem] text-white/50">{copy.hero.eyebrow}</span>
              </div>
              <div className="grid h-[calc(100%-2.5rem)] grid-cols-3 gap-2.5 p-3.5">
                <div className="rounded-xl bg-white/8 p-3">
                  <p className="text-[0.62rem] text-white/45">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</p>
                  <p className="mt-1 text-lg font-semibold">2.41M</p>
                </div>
                <div className="rounded-xl bg-white/8 p-3">
                  <p className="text-[0.62rem] text-white/45">{locale === 'ar' ? 'النقد' : 'Cash'}</p>
                  <p className="mt-1 text-lg font-semibold">1.18M</p>
                </div>
                <div className="rounded-xl bg-white/8 p-3">
                  <p className="text-[0.62rem] text-white/45">{locale === 'ar' ? 'الفريق' : 'Team'}</p>
                  <p className="mt-1 text-lg font-semibold">148</p>
                </div>
                <div className="col-span-3 rounded-xl bg-[#0b6fa4]/35 p-3">
                  <svg viewBox="0 0 260 64" className="h-full w-full" aria-hidden>
                    <path d="M0 48 L32 42 L64 44 L96 28 L128 32 L160 16 L192 20 L224 10 L260 14" fill="none" stroke="#8ed8f5" strokeWidth="2.4" />
                  </svg>
                </div>
              </div>
            </div>

            <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {HERO_MODULES.map((mod, i) => (
                <path
                  key={mod.id}
                  ref={(el) => {
                    pathRefs.current[i] = el;
                  }}
                  fill="none"
                  stroke="#1499d6"
                  strokeWidth="1.6"
                />
              ))}
              {PACKET_IDS.map((id, i) => (
                <circle
                  key={id}
                  ref={(el) => {
                    packetRefs.current[i] = el;
                  }}
                  r="4"
                  fill="#1499d6"
                />
              ))}
            </svg>

            {HERO_MODULES.map((mod, i) => (
              <ModulePanel
                key={mod.id}
                id={mod.id}
                name={mod.label[locale]}
                locale={locale}
                cardRef={(el) => {
                  moduleRefs.current[i] = el;
                }}
              />
            ))}

            <div ref={dashboardWrapRef} className="absolute inset-0 z-40 md:inset-[2%]" style={{ opacity: 0 }}>
              <ProductDashboard locale={locale} sample={copy.hero.sample} title={copy.hero.dashboardTitle} />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex h-auto w-full max-w-[36rem] flex-col justify-start px-5 pt-24 md:absolute md:inset-y-0 md:start-0 md:h-full md:justify-center md:px-12 md:pt-0">
          <p ref={eyebrowRef} className="text-[0.78rem] font-medium text-[#0b6fa4]">
            {copy.hero.eyebrow}
          </p>
          <div ref={headlineWrapRef}>
            <h1 className="mt-3 text-[clamp(2.5rem,6vw,5.6rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-[#0b1620]">
              <span className="block">{copy.hero.headlineLine1}</span>
              <span className="block">{copy.hero.headlineLine2}</span>
            </h1>
          </div>
          <p ref={supportRef} className="mt-5 max-w-md text-[1rem] leading-relaxed text-[#4d6472] md:text-[1.08rem]">
            {copy.hero.support}
          </p>
          <div ref={ctaRef} className="mt-7 flex flex-wrap gap-3">
            <MagneticButton href="/login" variant="brand">
              {copy.hero.demo}
            </MagneticButton>
            <MagneticButton href="#product" variant="brand-ghost">
              {copy.hero.explore}
            </MagneticButton>
          </div>
        </div>

        <div
          ref={wipeRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 bg-[#061826]"
          style={{ clipPath: 'circle(0% at 38% 55%)', opacity: 0 }}
        />
      </div>
    </section>
  );
}
