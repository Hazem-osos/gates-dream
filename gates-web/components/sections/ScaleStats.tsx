'use client';

import { useLayoutEffect, useRef } from 'react';
import { SCALE_PLACEHOLDERS } from '../../data/statistics';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

/**
 * DEV: SCALE_PLACEHOLDERS must be replaced with verified real numbers before production.
 * Do not invent years, businesses, users, or module counts.
 */
export function ScaleStats() {
  const { copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const valueRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const items = [
    { value: SCALE_PLACEHOLDERS.years, label: copy.scale.years },
    { value: SCALE_PLACEHOLDERS.businesses, label: copy.scale.businesses },
    { value: SCALE_PLACEHOLDERS.users, label: copy.scale.users },
    { value: SCALE_PLACEHOLDERS.modules, label: copy.scale.modules },
  ];

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const values = valueRefs.current.filter(Boolean) as HTMLParagraphElement[];
      gsap.set(values, { clipPath: 'inset(100% 0 0 0)' });

      const reveal = () => {
        gsap.to(values, {
          clipPath: 'inset(0% 0 0 0)',
          duration: 0.9,
          stagger: 0.08,
          ease: 'power3.out',
          overwrite: true,
        });
      };

      const hide = () => {
        gsap.set(values, { clipPath: 'inset(100% 0 0 0)' });
      };

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        gsap.set(values, { clipPath: 'inset(0% 0 0 0)' });
        emitNavTheme('light');
        return;
      }

      gsap.to({}, {
        scrollTrigger: {
          trigger: section,
          start: 'top 72%',
          end: 'bottom 40%',
          onEnter: () => {
            emitNavTheme('light');
            reveal();
          },
          onEnterBack: () => {
            emitNavTheme('light');
            reveal();
          },
          onLeaveBack: hide,
        },
      });
    }, section);

    return () => ctx.revert();
  }, [copy]);

  return (
    <section
      ref={sectionRef}
      id="scale"
      className="bg-[var(--background)] px-5 py-24 text-[var(--foreground)] md:px-12 md:py-36"
      aria-label={copy.scale.eyebrow}
    >
      <div className="mx-auto max-w-[88rem]">
        <SectionLabel index="09">{copy.scale.eyebrow}</SectionLabel>
        <p className="sr-only">Placeholder figures. Replace with verified production numbers.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {items.map((item, i) => (
            <div key={item.label} className="border-t border-[var(--foreground)]/12 pt-6">
              <p
                ref={(el) => {
                  valueRefs.current[i] = el;
                }}
                className="font-editorial text-[clamp(3.4rem,10vw,8rem)] leading-none tracking-[-0.05em]"
              >
                {item.value}
              </p>
              <p className="mt-3 text-sm text-[var(--foreground)]/45">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ScaleStats;
