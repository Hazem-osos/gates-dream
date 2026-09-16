'use client';

import { useLayoutEffect, useRef } from 'react';
import { emitNavTheme } from '../../lib/animations';
import { gsap, registerGsapPlugins } from '../../lib/gsap';
import { useMarketingLocale } from '../../lib/marketing/locale';
import {
  BooksScreen,
  CaptionCard,
  DashboardScreen,
  GatesAppFrame,
  SalesScreen,
  StockScreen,
} from './AppStoryScreens';
import './app-story.css';

const P = {
  dash: 0,
  sale: 0.16,
  stock: 0.38,
  books: 0.6,
  close: 0.8,
};

export function AppStoryJourney() {
  const { copy, locale } = useMarketingLocale();
  const c = copy.appStory;

  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const screens = useRef<(HTMLDivElement | null)[]>([]);
  const captions = useRef<(HTMLDivElement | null)[]>([]);
  const nav = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const section = sectionRef.current;
    const frame = frameRef.current;
    if (!section || !frame) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (media) => {
          const reduced = Boolean(media.conditions?.reduce);
          const caps = captions.current.filter(Boolean) as HTMLDivElement[];
          const views = screens.current.filter(Boolean) as HTMLDivElement[];
          const items = nav.current.filter(Boolean) as HTMLDivElement[];
          const stock = { n: 124 };

          const showNav = (index: number) => {
            items.forEach((item, i) => item.setAttribute('data-on', i === index ? 'true' : 'false'));
          };

          const setIntro = () => {
            gsap.set(caps, { opacity: 0, y: 16 });
            gsap.set(caps[0], { opacity: 1, y: 0 });
            gsap.set(views, { opacity: 0, y: 18 });
            gsap.set(views[0], { opacity: 1, y: 0 });
            gsap.set(toastRef.current, { opacity: 0, y: 16 });
            gsap.set(badgeRef.current, { opacity: 0, scale: 0.86 });
            stock.n = 124;
            if (stockRef.current) stockRef.current.textContent = '124';
            showNav(0);
          };

          const setFinale = () => {
            gsap.set(caps, { opacity: 0 });
            gsap.set(caps[4], { opacity: 1, y: 0 });
            gsap.set(views, { opacity: 0 });
            gsap.set(views[3], { opacity: 1, y: 0 });
            gsap.set(toastRef.current, { opacity: 1, y: 0 });
            gsap.set(badgeRef.current, { opacity: 1, scale: 1 });
            stock.n = 123;
            if (stockRef.current) stockRef.current.textContent = '123';
            showNav(3);
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
              onUpdate: (self) => {
                emitNavTheme('light');
                const p = self.progress;
                if (p < P.sale) showNav(0);
                else if (p < P.stock) showNav(1);
                else if (p < P.books) showNav(2);
                else showNav(3);
              },
            },
          });

          tl.to({}, { duration: 0.12 }, P.dash);

          tl.to(caps[0], { opacity: 0, y: -16, duration: 0.04 }, P.sale);
          tl.to(views[0], { opacity: 0, y: -12, duration: 0.04 }, P.sale);
          tl.to(views[1], { opacity: 1, y: 0, duration: 0.05 }, P.sale + 0.02);
          tl.to(caps[1], { opacity: 1, y: 0, duration: 0.05 }, P.sale + 0.02);
          tl.to(badgeRef.current, { opacity: 1, scale: 1, duration: 0.04 }, P.sale + 0.06);

          tl.to(caps[1], { opacity: 0, y: -16, duration: 0.04 }, P.stock);
          tl.to(views[1], { opacity: 0, y: -12, duration: 0.04 }, P.stock);
          tl.to(views[2], { opacity: 1, y: 0, duration: 0.05 }, P.stock + 0.02);
          tl.to(caps[2], { opacity: 1, y: 0, duration: 0.05 }, P.stock + 0.02);
          tl.to(
            stock,
            {
              n: 123,
              duration: 0.08,
              snap: { n: 1 },
              onUpdate: () => {
                if (stockRef.current) stockRef.current.textContent = String(stock.n);
              },
            },
            P.stock + 0.06
          );
          tl.to(toastRef.current, { opacity: 1, y: 0, duration: 0.05 }, P.stock + 0.08);

          tl.to(caps[2], { opacity: 0, y: -16, duration: 0.04 }, P.books);
          tl.to(views[2], { opacity: 0, y: -12, duration: 0.04 }, P.books);
          tl.to(toastRef.current, { opacity: 0, duration: 0.03 }, P.books);
          tl.to(views[3], { opacity: 1, y: 0, duration: 0.05 }, P.books + 0.02);
          tl.to(caps[3], { opacity: 1, y: 0, duration: 0.05 }, P.books + 0.02);

          tl.to(caps[3], { opacity: 0, y: -16, duration: 0.04 }, P.close);
          tl.to(caps[4], { opacity: 1, y: 0, duration: 0.06 }, P.close + 0.02);
        }
      );
    }, section);

    return () => ctx.revert();
  }, [locale]);

  return (
    <section
      ref={sectionRef}
      id="opening"
      className="gates-story relative h-[620vh] md:h-[760vh]"
      aria-label={c.capDash}
    >
      <div className="gates-cinematic-stage sticky top-0 h-[100svh] overflow-hidden">
        <div className="gates-story-stage">
          <div className="gates-story-caption">
            <CaptionCard
              cardRef={(el) => {
                captions.current[0] = el;
              }}
              kicker={c.capDashK}
              body={c.capDash}
            />
            <CaptionCard
              cardRef={(el) => {
                captions.current[1] = el;
              }}
              kicker={c.capSaleK}
              body={c.capSale}
              theme="violet"
            />
            <CaptionCard
              cardRef={(el) => {
                captions.current[2] = el;
              }}
              kicker={c.capStockK}
              body={c.capStock}
              theme="lime"
            />
            <CaptionCard
              cardRef={(el) => {
                captions.current[3] = el;
              }}
              kicker={c.capBooksK}
              body={c.capBooks}
              theme="amber"
            />
            <CaptionCard
              cardRef={(el) => {
                captions.current[4] = el;
              }}
              kicker={c.capCloseK}
              body={c.capClose}
              theme="ice"
            />
          </div>

          <div className="gates-cinematic-scene">
            <GatesAppFrame
              frameRef={(el) => {
                frameRef.current = el;
              }}
              copy={c}
              nav={{
                dash: (el) => {
                  nav.current[0] = el;
                },
                sales: (el) => {
                  nav.current[1] = el;
                },
                stock: (el) => {
                  nav.current[2] = el;
                },
                books: (el) => {
                  nav.current[3] = el;
                },
                ai: () => undefined,
              }}
            >
              <DashboardScreen
                screenRef={(el) => {
                  screens.current[0] = el;
                }}
                copy={c}
              />
              <SalesScreen
                screenRef={(el) => {
                  screens.current[1] = el;
                }}
                badgeRef={(el) => {
                  badgeRef.current = el;
                }}
                copy={c}
              />
              <StockScreen
                screenRef={(el) => {
                  screens.current[2] = el;
                }}
                stockRef={(el) => {
                  stockRef.current = el;
                }}
                copy={c}
              />
              <BooksScreen
                screenRef={(el) => {
                  screens.current[3] = el;
                }}
                copy={c}
              />
              <div ref={toastRef} className="gates-toast">
                {c.toast}
              </div>
            </GatesAppFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
