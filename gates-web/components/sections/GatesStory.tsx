'use client';

import { useLayoutEffect, useRef } from 'react';
import { STORY_MILESTONES } from '../../data/story';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { SectionLabel } from '../ui/SectionLabel';

const HIDDEN = 'inset(100% 0 0 0)';
const VISIBLE = 'inset(0% 0 0 0)';
const EXIT = 'inset(0 0 100% 0)';

export function GatesStory() {
  const { locale, copy } = useMarketingLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const textRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const quoteRef = useRef<HTMLQuoteElement>(null);

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
          const numbers = numberRefs.current.filter(Boolean) as HTMLSpanElement[];
          const texts = textRefs.current.filter(Boolean) as HTMLParagraphElement[];
          const compact = Boolean(media.conditions?.mobile);
          const reduced = Boolean(media.conditions?.reduce);

          gsap.set(numbers, { clipPath: HIDDEN });
          gsap.set(texts, { clipPath: HIDDEN });
          gsap.set(numbers[0], { clipPath: VISIBLE });
          gsap.set(texts[0], { clipPath: VISIBLE });
          gsap.set(quoteRef.current, { clipPath: reduced ? VISIBLE : HIDDEN });

          if (reduced) {
            emitNavTheme('light');
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'power2.inOut' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: compact ? 0.3 : 0.6,
              invalidateOnRefresh: true,
              onEnter: () => emitNavTheme('light'),
              onEnterBack: () => emitNavTheme('light'),
            },
          });

          tl.fromTo(quoteRef.current, { clipPath: HIDDEN }, { clipPath: VISIBLE, duration: 0.1 }, 0.04);

          const slot = 0.82 / STORY_MILESTONES.length;
          STORY_MILESTONES.forEach((_, i) => {
            if (i === 0) return;
            const at = 0.12 + i * slot;
            tl.fromTo(numbers[i - 1], { clipPath: VISIBLE }, { clipPath: EXIT, duration: 0.08 }, at);
            tl.fromTo(texts[i - 1], { clipPath: VISIBLE }, { clipPath: EXIT, duration: 0.08 }, at);
            tl.fromTo(numbers[i], { clipPath: HIDDEN }, { clipPath: VISIBLE, duration: 0.08 }, at);
            tl.fromTo(texts[i], { clipPath: HIDDEN }, { clipPath: VISIBLE, duration: 0.08 }, at);
          });
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="company"
      className="relative h-[190vh] bg-[var(--background)] text-[var(--foreground)] md:h-[260vh]"
      aria-label={copy.story.headlineLine1}
    >
      <div className="sticky top-0 flex h-[100svh] overflow-hidden px-5 pb-8 pt-24 md:px-12 md:pt-28">
        <div className="mx-auto grid h-full w-full max-w-[88rem] grid-rows-[auto_1fr_auto] gap-8">
          <div>
            <SectionLabel index="04">{copy.story.eyebrow}</SectionLabel>
            <h2 className="mt-5 max-w-[16ch] font-editorial text-[clamp(2.2rem,5.4vw,5.6rem)] leading-[0.92] tracking-[-0.035em]">
              <span className="block">{copy.story.headlineLine1}</span>
              <span className="block text-[var(--foreground)]/55">{copy.story.headlineLine2}</span>
            </h2>
          </div>

          <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center">
            <div className="relative h-[0.82em] overflow-hidden font-editorial text-[clamp(6.5rem,22vw,18rem)] leading-none tracking-[-0.07em]">
              {STORY_MILESTONES.map((item, i) => (
                <span
                  key={item.id}
                  ref={(el) => {
                    numberRefs.current[i] = el;
                  }}
                  className="absolute inset-0"
                >
                  {item.id}
                </span>
              ))}
            </div>
            <div className="relative min-h-[4.5rem] md:min-h-[6rem]">
              {STORY_MILESTONES.map((item, i) => (
                <p
                  key={item.id}
                  ref={(el) => {
                    textRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 top-0 max-w-md text-lg leading-snug md:text-2xl"
                >
                  {item[locale]}
                </p>
              ))}
            </div>
          </div>

          <blockquote
            ref={quoteRef}
            className="max-w-2xl font-editorial text-[clamp(1.15rem,2.2vw,1.85rem)] leading-snug tracking-[-0.02em] text-[var(--foreground)]/78"
          >
            {copy.story.quote}
          </blockquote>
        </div>
      </div>
    </section>
  );
}

export default GatesStory;
