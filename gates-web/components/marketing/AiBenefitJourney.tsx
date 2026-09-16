'use client';

import { useLayoutEffect, useRef } from 'react';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import { AiScreen, CaptionCard, GatesAppFrame } from './AppStoryScreens';
import './app-story.css';

const P = {
  hold: 0,
  leave: 0.28,
  ask: 0.4,
  answer: 0.56,
  draft: 0.76,
  close: 0.9,
};

export function AiBenefitJourney() {
  const { copy, locale } = useMarketingLocale();
  const c = copy.appStory;
  const a = copy.aiJourney;

  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const appWrapRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const qRef = useRef<HTMLDivElement>(null);
  const a1Ref = useRef<HTMLDivElement>(null);
  const a2Ref = useRef<HTMLDivElement>(null);
  const a3Ref = useRef<HTMLDivElement>(null);
  const recRef = useRef<HTMLDivElement>(null);
  const actRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const aiNavRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (media) => {
          const reduced = Boolean(media.conditions?.reduce);
          const tiles = cards.current.filter(Boolean) as HTMLDivElement[];
          const chat = [qRef.current, a1Ref.current, a2Ref.current, a3Ref.current, recRef.current, actRef.current];

          const setIntro = () => {
            gsap.set(headRef.current, { opacity: 1, y: 0 });
            gsap.set(benefitsRef.current, { opacity: 1, y: 0 });
            gsap.set(tiles, { opacity: 1, y: 0 });
            gsap.set(appWrapRef.current, { opacity: 0, y: 28, scale: 0.96 });
            gsap.set(captionRef.current, { opacity: 0, y: 16 });
            gsap.set(closeRef.current, { opacity: 0, y: 16 });
            gsap.set(chat, { opacity: 0, y: 12 });
            gsap.set(draftRef.current, { opacity: 0, y: 16 });
            aiNavRef.current?.setAttribute('data-on', 'true');
          };

          const setFinale = () => {
            gsap.set([headRef.current, benefitsRef.current], { opacity: 0 });
            gsap.set(appWrapRef.current, { opacity: 1, y: 0, scale: 1 });
            gsap.set(captionRef.current, { opacity: 0 });
            gsap.set(closeRef.current, { opacity: 1, y: 0 });
            gsap.set(chat, { opacity: 1, y: 0 });
            gsap.set(draftRef.current, { opacity: 1, y: 0 });
          };

          setIntro();
          emitNavTheme('light');
          if (reduced) {
            setFinale();
            return;
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none', force3D: true },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.65,
              invalidateOnRefresh: true,
              onUpdate: () => emitNavTheme('light'),
            },
          });

          tl.to({}, { duration: 0.2 }, P.hold);
          tl.to(tiles, { opacity: 1, y: 0, stagger: 0.02, duration: 0.06 }, P.hold);

          tl.to(headRef.current, { opacity: 0, y: -20, duration: 0.05 }, P.leave);
          tl.to(benefitsRef.current, { opacity: 0, y: -24, duration: 0.06 }, P.leave);
          tl.to(appWrapRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.08 }, P.leave + 0.02);
          tl.to(captionRef.current, { opacity: 1, y: 0, duration: 0.05 }, P.ask);

          tl.to(qRef.current, { opacity: 1, y: 0, duration: 0.04 }, P.ask + 0.02);
          tl.to(a1Ref.current, { opacity: 1, y: 0, duration: 0.04 }, P.answer);
          tl.to(a2Ref.current, { opacity: 1, y: 0, duration: 0.04 }, P.answer + 0.04);
          tl.to(a3Ref.current, { opacity: 1, y: 0, duration: 0.04 }, P.answer + 0.08);
          tl.to(recRef.current, { opacity: 1, y: 0, duration: 0.04 }, P.answer + 0.12);
          tl.to(actRef.current, { opacity: 1, y: 0, duration: 0.04 }, P.draft);
          tl.to(draftRef.current, { opacity: 1, y: 0, duration: 0.05 }, P.draft + 0.02);

          tl.to(captionRef.current, { opacity: 0, y: -16, duration: 0.04 }, P.close);
          tl.to(closeRef.current, { opacity: 1, y: 0, duration: 0.05 }, P.close + 0.02);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  const benefits = [
    { t: a.b1t, b: a.b1 },
    { t: a.b2t, b: a.b2 },
    { t: a.b3t, b: a.b3 },
    { t: a.b4t, b: a.b4 },
  ];

  return (
    <section
      ref={sectionRef}
      id="product-scale"
      className="gates-story relative h-[680vh] md:h-[840vh]"
      aria-label={a.aiH}
    >
      <div className="gates-cinematic-stage sticky top-0 h-[100svh] overflow-hidden">
        <div className="relative flex h-full items-center justify-center px-[4vw] pt-24">
          <div ref={headRef} className="absolute inset-x-[6vw] top-[18%] z-10">
            <div className="gates-ai-head">
              <p className="meta">{a.kicker}</p>
              <h2>
                {a.h1}
                <br />
                {a.h2}
              </h2>
            </div>
          </div>

          <div ref={benefitsRef} className="gates-benefits relative z-10 mt-16 md:mt-24">
            {benefits.map((item, i) => (
              <article
                key={item.t}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                className="gates-benefit"
              >
                <p className="meta">0{i + 1}</p>
                <h3>{item.t}</h3>
                <p>{item.b}</p>
              </article>
            ))}
          </div>

          <div ref={appWrapRef} className="gates-story-stage absolute inset-0 z-20">
            <div className="gates-story-caption">
              <CaptionCard cardRef={(el) => { captionRef.current = el; }} kicker={a.aiK} body={a.aiSub} theme="violet" />
              <CaptionCard cardRef={(el) => { closeRef.current = el; }} kicker={a.closeK} body={a.close} theme="ice" />
            </div>
            <div className="gates-cinematic-scene">
              <GatesAppFrame
                frameRef={() => undefined}
                active="ai"
                copy={c}
                nav={{
                  dash: () => undefined,
                  sales: () => undefined,
                  stock: () => undefined,
                  books: () => undefined,
                  ai: (el) => {
                    aiNavRef.current = el;
                  },
                }}
              >
                <AiScreen
                  screenRef={(el) => {
                    screenRef.current = el;
                  }}
                  qRef={(el) => {
                    qRef.current = el;
                  }}
                  a1Ref={(el) => {
                    a1Ref.current = el;
                  }}
                  a2Ref={(el) => {
                    a2Ref.current = el;
                  }}
                  a3Ref={(el) => {
                    a3Ref.current = el;
                  }}
                  recRef={(el) => {
                    recRef.current = el;
                  }}
                  actRef={(el) => {
                    actRef.current = el;
                  }}
                  draftRef={(el) => {
                    draftRef.current = el;
                  }}
                  copy={c}
                  ai={a}
                />
              </GatesAppFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
