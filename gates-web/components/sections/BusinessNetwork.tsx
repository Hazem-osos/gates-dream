'use client';

import { useLayoutEffect, useRef } from 'react';
import { NETWORK_NODES, NETWORK_PACKET_PATHS, networkPoint } from '../../data/network';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

const CORE = { x: 50, y: 50 };

function curve(x: number, y: number) {
  const mx = (CORE.x + x) / 2;
  const my = (CORE.y + y) / 2;
  const ox = mx + (CORE.y - y) * 0.12;
  const oy = my + (x - CORE.x) * 0.12;
  return `M ${CORE.x} ${CORE.y} Q ${ox} ${oy} ${x} ${y}`;
}

export function BusinessNetwork() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const packetRefs = useRef<(SVGRectElement | null)[]>([]);
  const copyRef = useRef<HTMLDivElement>(null);

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
          const nodes = nodeRefs.current.filter(Boolean) as SVGGElement[];
          const paths = pathRefs.current.filter(Boolean) as SVGPathElement[];
          const packets = packetRefs.current.filter(Boolean) as SVGRectElement[];

          const ringOf = (i: number) => NETWORK_NODES[i]?.ring ?? 1;
          const ring1 = nodes.filter((_, i) => ringOf(i) === 1);
          const ring2 = nodes.filter((_, i) => ringOf(i) === 2);
          const ring3 = nodes.filter((_, i) => ringOf(i) === 3);
          const paths1 = paths.filter((_, i) => ringOf(i) === 1);
          const paths2 = paths.filter((_, i) => ringOf(i) === 2);
          const paths3 = paths.filter((_, i) => ringOf(i) === 3);

          paths.forEach((path) => {
            const length = path.getTotalLength();
            path.setAttribute('stroke-dasharray', String(length));
            path.setAttribute('stroke-dashoffset', String(length));
          });

          gsap.set(graphRef.current, { scale: compact ? 1.18 : 1.42, transformOrigin: '50% 50%' });
          gsap.set([...ring2, ...ring3], { opacity: 0, scale: 0.86, transformOrigin: '50% 50%' });
          gsap.set(ring1, { opacity: 1, scale: 1 });
          gsap.set(paths, { opacity: 0 });
          gsap.set(packets, { opacity: 0 });
          gsap.set(copyRef.current, { y: 0, opacity: 1 });

          if (reduced) {
            gsap.set(graphRef.current, { scale: compact ? 0.92 : 0.78 });
            gsap.set(nodes, { opacity: 1, scale: 1 });
            gsap.set(paths, { opacity: 0.45, attr: { 'stroke-dashoffset': 0 } });
            emitNavTheme('dark');
            return;
          }

          // One timeline: compact departments → branches → external → full network
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.35 : 0.7,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('dark'),
              onEnterBack: () => emitNavTheme('dark'),
            },
          });

          // Stage 1 — 0–22%: inner departments, first paths
          tl.to(paths1, { opacity: 0.55, duration: 0.06 }, 0.04);
          paths1.forEach((path) => {
            tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: 0.14, ease: 'power2.out' }, 0.06);
          });

          // Stage 2 — 22–48%: zoom out, branches
          tl.to(graphRef.current, { scale: compact ? 1.04 : 1.08, duration: 0.26, ease: 'power2.inOut' }, 0.22);
          tl.to(copyRef.current, { y: compact ? -8 : -18, duration: 0.26 }, 0.22);
          tl.to(ring2, { opacity: 1, scale: 1, duration: 0.12 }, 0.28);
          tl.to(paths2, { opacity: 0.5, duration: 0.06 }, 0.3);
          paths2.forEach((path) => {
            tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: 0.14, ease: 'power2.out' }, 0.3);
          });

          // Stage 3 — 48–72%: farther zoom, external entities
          tl.to(graphRef.current, { scale: compact ? 0.94 : 0.86, duration: 0.24, ease: 'power2.inOut' }, 0.48);
          tl.to(ring3, { opacity: 1, scale: 1, duration: 0.12 }, 0.52);
          tl.to(paths3, { opacity: 0.45, duration: 0.06 }, 0.54);
          paths3.forEach((path) => {
            tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: 0.14, ease: 'power2.out' }, 0.54);
          });

          // Stage 4 — 72–100%: one network, packets, settled scale
          tl.to(graphRef.current, { scale: compact ? 0.9 : 0.78, duration: 0.16, ease: 'power2.inOut' }, 0.72);
          tl.to(paths, { opacity: 0.62, duration: 0.1 }, 0.74);
          packets.forEach((packet, i) => {
            const nodeId = NETWORK_PACKET_PATHS[i];
            const path = paths[NETWORK_NODES.findIndex((n) => n.id === nodeId)];
            if (!path) return;
            tl.to(packet, { opacity: 1, duration: 0.04 }, 0.76);
            tl.to(
              packet,
              {
                motionPath: {
                  path,
                  align: path,
                  alignOrigin: [0.5, 0.5],
                  autoRotate: false,
                },
                duration: 0.22,
                ease: 'none',
              },
              0.76
            );
          });
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="network"
      className="relative h-[230vh] bg-[#070B12] text-[#F5F5F1] md:h-[360vh]"
      aria-label={copy.network.headlineLine1}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
          <div className="gates-tech-grid-dark h-full w-full" />
        </div>

        <div
          ref={graphRef}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg viewBox="0 0 100 100" className="h-[min(128vw,92vh)] w-[min(128vw,92vh)]" aria-hidden>
            <g>
              {NETWORK_NODES.map((node, i) => {
                const p = networkPoint(node);
                return (
                  <path
                    key={`p-${node.id}`}
                    ref={(el) => {
                      pathRefs.current[i] = el;
                    }}
                    d={curve(p.x, p.y)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.12"
                    className="text-white/70"
                  />
                );
              })}
            </g>
            {NETWORK_PACKET_PATHS.map((id, i) => (
              <rect
                key={`pkt-${id}`}
                ref={(el) => {
                  packetRefs.current[i] = el;
                }}
                width="0.7"
                height="0.7"
                fill="var(--accent)"
              />
            ))}
            <g>
              <circle cx={CORE.x} cy={CORE.y} r="6.2" fill="#070B12" stroke="currentColor" strokeWidth="0.18" />
              <line x1={CORE.x} y1={CORE.y - 8} x2={CORE.x} y2={CORE.y - 6.4} stroke="currentColor" strokeWidth="0.12" />
              <line x1={CORE.x} y1={CORE.y + 6.4} x2={CORE.x} y2={CORE.y + 8} stroke="currentColor" strokeWidth="0.12" />
              <line x1={CORE.x - 8} y1={CORE.y} x2={CORE.x - 6.4} y2={CORE.y} stroke="currentColor" strokeWidth="0.12" />
              <line x1={CORE.x + 6.4} y1={CORE.y} x2={CORE.x + 8} y2={CORE.y} stroke="currentColor" strokeWidth="0.12" />
              <text
                x={CORE.x}
                y={CORE.y + 0.6}
                textAnchor="middle"
                className="fill-white"
                style={{ fontSize: '1.6px', letterSpacing: '0.18px' }}
              >
                {copy.network.core}
              </text>
            </g>
            {NETWORK_NODES.map((node, i) => {
              const p = networkPoint(node);
              return (
                <g key={node.id} transform={`translate(${p.x} ${p.y})`}>
                  <g
                    ref={(el) => {
                      nodeRefs.current[i] = el;
                    }}
                  >
                    <rect
                      x="-7.2"
                      y="-2.1"
                      width="14.4"
                      height="4.2"
                      fill="#070B12"
                      stroke="currentColor"
                      strokeWidth="0.12"
                    />
                    <text
                      y="0.55"
                      textAnchor="middle"
                      className="fill-white"
                      style={{ fontSize: compactLabel(locale), letterSpacing: '0.16px' }}
                    >
                      {node.label[locale]}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <div
          ref={copyRef}
          className="relative z-10 mx-auto flex h-full max-w-[88rem] flex-col justify-between px-5 py-24 md:px-12 md:py-28"
        >
          <div>
            <SectionLabel index="05" tone="dark">
              {copy.network.eyebrow}
            </SectionLabel>
            <h2 className="mt-5 max-w-[14ch] font-editorial text-[clamp(2.1rem,5vw,5.2rem)] leading-[0.92] tracking-[-0.035em]">
              <span className="block">{copy.network.headlineLine1}</span>
              <span className="block">{copy.network.headlineLine2}</span>
              <span className="block text-white/55">{copy.network.headlineLine3}</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/50 md:text-base">{copy.network.support}</p>
        </div>
      </div>
    </section>
  );
}

function compactLabel(locale: 'ar' | 'en') {
  return locale === 'ar' ? '1.45px' : '1.35px';
}

export default BusinessNetwork;
