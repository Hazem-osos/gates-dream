'use client';

import { useLayoutEffect, useRef } from 'react';
import { HERO_MODULES } from '../../data/modules';
import { emitNavTheme, HERO } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { MagneticButton } from '../animations/MagneticButton';
import { ModuleCard } from '../ui/ModuleCard';
import { SectionLabel } from '../ui/SectionLabel';

const PHASE = HERO.phases;
const PACKET_INDEX = [0, 2, 5] as const;

function place(field: HTMLElement, pct: { x: number; y: number }, compact: boolean) {
  const scale = compact ? 0.78 : 1;
  return {
    x: (pct.x / 100) * field.clientWidth * scale,
    y: (pct.y / 100) * field.clientHeight * scale,
  };
}

function curve(x1: number, y1: number, x2: number, y2: number, swing: number) {
  const mx = (x1 + x2) / 2 + (y1 - y2) * swing;
  const my = (y1 + y2) / 2 + (x2 - x1) * swing;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

export function HeroSystem() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const moduleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const packetRefs = useRef<(SVGRectElement | null)[]>([]);
  const coreRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLParagraphElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const field = fieldRef.current;
    const svg = svgRef.current;
    if (!section || !field || !svg) return;

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
          const modules = moduleRefs.current.filter(Boolean) as HTMLDivElement[];
          const paths = pathRefs.current.filter(Boolean) as SVGPathElement[];
          const packets = packetRefs.current.filter(Boolean) as SVGRectElement[];

          const layoutPaths = () => {
            const w = field.clientWidth;
            const h = field.clientHeight;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            paths.forEach((path, i) => {
              const dock = place(field, HERO_MODULES[i].dock, compact);
              path.setAttribute(
                'd',
                curve(w / 2 + dock.x, h / 2 + dock.y, w / 2, h / 2, compact ? 0.08 : 0.14)
              );
              const length = path.getTotalLength();
              path.setAttribute('stroke-dasharray', String(length));
              path.setAttribute('stroke-dashoffset', String(length));
            });
          };

          layoutPaths();
          paths.forEach((path) => gsap.set(path, { opacity: 0 }));

          modules.forEach((el, i) => {
            const pos = place(field, HERO_MODULES[i].start, compact);
            gsap.set(el, { xPercent: -50, yPercent: -50, x: pos.x, y: pos.y, opacity: 1, scale: 1 });
          });

          gsap.set(packets, { opacity: 0 });
          gsap.set(coreRef.current, {
            xPercent: -50,
            yPercent: -50,
            opacity: 1,
            scale: 1,
            clipPath: 'inset(50%)',
          });
          gsap.set(viewportRef.current, { opacity: 0, y: 36 });
          gsap.set(wipeRef.current, { scaleY: 0, transformOrigin: '50% 100%' });
          gsap.set([headlineRef.current, supportRef.current, ctaRef.current], {
            opacity: 1,
            y: 0,
            clipPath: 'inset(0% 0 0 0)',
          });
          gsap.set(brandRef.current, { opacity: 0.045, scale: 1 });
          emitNavTheme('light');

          if (reduced) {
            modules.forEach((el, i) => {
              const pos = place(field, HERO_MODULES[i].dock, compact);
              gsap.set(el, { xPercent: -50, yPercent: -50, x: pos.x, y: pos.y });
            });
            gsap.set(coreRef.current, { clipPath: 'inset(0%)' });
            gsap.set(paths, { opacity: 0.35, attr: { 'stroke-dashoffset': 0 } });
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.28 : 0.48,
              invalidateOnRefresh: true,
              onRefresh: layoutPaths,
              onUpdate: (self) => {
                emitNavTheme(self.progress >= 0.9 ? 'dark' : 'light');
              },
            },
          });

          // 0–10% hold. Type owns the frame. Modules stay at the edge.
          tl.to(modules, { duration: PHASE.stillEnd }, 0);

          // 10–40% travel — each plate takes its own route.
          const travel = PHASE.travelEnd - PHASE.stillEnd;
          modules.forEach((el, i) => {
            const via = place(field, HERO_MODULES[i].via, compact);
            const dock = place(field, HERO_MODULES[i].dock, compact);
            const stagger = i * 0.012;
            tl.to(
              el,
              { x: via.x, y: via.y, duration: travel * 0.55, ease: 'power2.inOut' },
              PHASE.stillEnd + stagger
            );
            tl.to(
              el,
              { x: dock.x, y: dock.y, duration: travel * 0.45, ease: 'power3.out' },
              PHASE.stillEnd + travel * 0.55 + stagger
            );
          });

          // 40–56% connections draw in sequence. A few ink packets follow.
          paths.forEach((path, i) => {
            const at = PHASE.travelEnd + i * 0.018;
            tl.to(path, { opacity: 0.45, duration: 0.02 }, at);
            tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: 0.1, ease: 'power2.inOut' }, at);
          });
          packets.forEach((packet, i) => {
            const path = paths[PACKET_INDEX[i]];
            if (!path) return;
            const at = PHASE.travelEnd + 0.06 + i * 0.03;
            tl.to(packet, { opacity: 1, duration: 0.02 }, at);
            tl.to(
              packet,
              {
                motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false },
                duration: 0.1,
                ease: 'none',
              },
              at
            );
          });

          // 56–70% core is revealed by clip, not a bounce. Type begins to yield.
          tl.to(coreRef.current, { clipPath: 'inset(0%)', duration: 0.12, ease: 'power2.inOut' }, PHASE.connectEnd);
          tl.to(brandRef.current, { opacity: 0.07, scale: compact ? 1.08 : 1.18, duration: 0.14 }, PHASE.connectEnd);
          tl.to(headlineRef.current, { opacity: 0.72, y: compact ? -8 : -16, duration: 0.14 }, PHASE.connectEnd);

          // 70–84% the system is the subject. Type exits by clip.
          tl.to(coreRef.current, { scale: compact ? 1.08 : 1.16, duration: 0.14, ease: 'power2.inOut' }, PHASE.coreEnd);
          tl.to(
            headlineRef.current,
            { clipPath: 'inset(0 0 100% 0)', opacity: 0, duration: 0.1, ease: 'power2.in' },
            PHASE.coreEnd
          );
          tl.to([supportRef.current, ctaRef.current], { opacity: 0, y: -12, duration: 0.08 }, PHASE.coreEnd + 0.02);
          tl.to(modules, { scale: 0.9, duration: 0.14 }, PHASE.coreEnd);

          // 84–100% abstract viewport, then the ink field rises into section two.
          tl.to(modules, { opacity: 0, duration: 0.06 }, PHASE.settleEnd);
          tl.to([coreRef.current, ...paths, ...packets, brandRef.current], { opacity: 0, duration: 0.06 }, PHASE.settleEnd);
          tl.to(viewportRef.current, { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, PHASE.settleEnd + 0.02);
          tl.to(wipeRef.current, { scaleY: 1, duration: 0.1, ease: 'power3.inOut' }, 0.9);
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
      className="relative h-[210vh] md:h-[380vh]"
      aria-label={copy.hero.headlineLine1}
    >
      <div className="gates-hero-stage sticky top-0 h-[100svh] overflow-hidden bg-[var(--background)]">
        <p
          ref={brandRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[36%] text-center font-editorial text-[clamp(5rem,18vw,14rem)] leading-[0.78] tracking-[-0.06em] text-[var(--foreground)]"
        >
          {copy.wordmark}
        </p>

        <div ref={fieldRef} className="absolute inset-x-0 bottom-[6%] top-[30%] md:top-[24%]">
          <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {HERO_MODULES.map((mod, i) => (
              <path
                key={mod.id}
                ref={(el) => {
                  pathRefs.current[i] = el;
                }}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-[var(--foreground)]"
              />
            ))}
            {PACKET_INDEX.map((src, i) => (
              <rect
                key={`pkt-${src}`}
                ref={(el) => {
                  packetRefs.current[i] = el;
                }}
                width="4"
                height="4"
                fill="var(--foreground)"
              />
            ))}
          </svg>

          {HERO_MODULES.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              locale={locale}
              cardRef={(el) => {
                moduleRefs.current[i] = el;
              }}
            />
          ))}

          <div
            ref={coreRef}
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[7.5rem] md:w-[10.5rem]"
          >
            <div className="relative aspect-square border border-[var(--foreground)]/28 bg-[var(--background)]">
              <span className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-[var(--foreground)]/25" />
              <span className="absolute bottom-0 left-1/2 h-2.5 w-px -translate-x-1/2 bg-[var(--foreground)]/25" />
              <span className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-[var(--foreground)]/25" />
              <span className="absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-[var(--foreground)]/25" />
              <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                <span className="text-[0.62rem] font-medium uppercase tracking-[0.22em] md:text-[0.7rem]">
                  {copy.hero.core}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-30 flex h-full flex-col justify-between px-5 pb-8 pt-24 md:px-12 md:pb-12 md:pt-28">
          <div ref={headlineRef} className="max-w-[20rem] md:max-w-[36rem]">
            <SectionLabel>{copy.hero.eyebrow}</SectionLabel>
            <h1 className="mt-6 font-editorial text-[clamp(2.4rem,6.4vw,6.4rem)] leading-[1.05] text-[var(--foreground)] md:leading-[0.92]">
              <span className="block">{copy.hero.headlineLine1}</span>
              <span className="block">{copy.hero.headlineLine2}</span>
            </h1>
          </div>

          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p
              ref={supportRef}
              className="max-w-sm text-[0.88rem] leading-relaxed text-[var(--foreground)]/48 md:text-[1.02rem]"
            >
              {copy.hero.support}
            </p>
            <div ref={ctaRef} className="flex flex-wrap gap-3">
              <MagneticButton href="#product">{copy.hero.explore}</MagneticButton>
              <MagneticButton href="/login" variant="ghost">
                {copy.hero.demo}
              </MagneticButton>
            </div>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="pointer-events-none absolute inset-x-[6%] top-[22%] z-20 mx-auto w-[min(88%,44rem)] border border-[var(--foreground)]/20 bg-[var(--background)] md:top-[20%]"
          aria-hidden
        >
          <div className="border-b border-[var(--foreground)]/12 px-4 py-2 font-mono text-[0.58rem] tracking-[0.2em] text-[var(--foreground)]/35">
            {copy.hero.sample}
          </div>
          <div className="grid grid-cols-3 gap-px bg-[var(--foreground)]/10 p-px">
            {['01', '02', '03'].map((n) => (
              <div key={n} className="h-28 bg-[var(--background)] p-3 md:h-40">
                <span className="font-mono text-[0.55rem] text-[var(--foreground)]/30">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          ref={wipeRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 origin-bottom bg-[var(--surface-ink)]"
        />
      </div>
    </section>
  );
}
