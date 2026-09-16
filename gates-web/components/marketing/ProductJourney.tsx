'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { useMarketingLocale } from '../../lib/marketing/locale';
import {
  ActionScreen,
  AskScreen,
  BooksScreen,
  DashboardScreen,
  GatesAppFrame,
  SalesScreen,
  SentinelScreen,
  StockScreen,
} from './AppStoryScreens';
import './app-story.css';

function Chapter({
  id,
  kicker,
  title,
  body,
  wide,
  extra,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  body: string;
  wide?: boolean;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} data-journey-chapter className="gates-chapter" data-wide={wide ? 'true' : undefined} aria-label={title}>
      <div className="gates-chapter-inner">
        <div className="gates-chapter-copy">
          <p className="gates-chapter-idx">{kicker}</p>
          <h2>{title}</h2>
          <p className="lead">{body}</p>
          {extra}
        </div>
        {children ? <div className="gates-chapter-stage">{children}</div> : null}
      </div>
    </section>
  );
}

export function ProductJourney() {
  const { copy } = useMarketingLocale();
  const app = copy.appStory;
  const j = copy.journey;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-journey-chapter]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.setAttribute('data-in', 'true');
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    chapters.forEach((chapter) => io.observe(chapter));
    return () => io.disconnect();
  }, []);

  const emptyNav = {
    dash: () => undefined,
    sales: () => undefined,
    stock: () => undefined,
    books: () => undefined,
    ai: () => undefined,
  };

  return (
    <div ref={rootRef} className="gates-story">
      <Chapter id="opening" kicker={j.insideK} title={j.insideT} body={j.insideB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="dash">
          <DashboardScreen screenRef={() => undefined} copy={app} />
        </GatesAppFrame>
      </Chapter>

      <Chapter id="journey-sale" kicker={j.saleK} title={j.saleT} body={j.saleB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="sales">
          <SalesScreen screenRef={() => undefined} badgeRef={() => undefined} copy={app} />
        </GatesAppFrame>
      </Chapter>

      <Chapter id="journey-stock" kicker={j.stockK} title={j.stockT} body={j.stockB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="stock">
          <StockScreen
            screenRef={() => undefined}
            stockRef={(el) => {
              if (el) el.textContent = '123';
            }}
            copy={app}
          />
          <div className="gates-toast">{app.toast}</div>
        </GatesAppFrame>
      </Chapter>

      <Chapter id="journey-books" kicker={j.booksK} title={j.booksT} body={j.booksB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="books">
          <BooksScreen screenRef={() => undefined} copy={app} />
        </GatesAppFrame>
      </Chapter>

      <Chapter id="journey-sentinel" kicker={j.sentK} title={j.sentT} body={j.sentB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="ai">
          <SentinelScreen copy={app} journey={j} />
        </GatesAppFrame>
      </Chapter>

      <Chapter id="ai" kicker={j.askK} title={j.askT} body={j.askB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="ai">
          <AskScreen copy={app} journey={j} />
        </GatesAppFrame>
      </Chapter>

      <Chapter id="journey-act" kicker={j.actK} title={j.actT} body={j.actB}>
        <GatesAppFrame frameRef={() => undefined} copy={app} nav={emptyNav} active="ai">
          <ActionScreen journey={j} />
        </GatesAppFrame>
      </Chapter>

      <Chapter
        id="product-scale"
        kicker={j.whyK}
        title={j.whyT}
        body={j.whyB}
        wide
        extra={
          <>
            <div className="gates-why">
              {[
                [j.b1t, j.b1],
                [j.b2t, j.b2],
                [j.b3t, j.b3],
                [j.b4t, j.b4],
              ].map(([title, body]) => (
                <article key={title} className="gates-benefit">
                  <p className="meta">GATES</p>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
            <p className="gates-modline">{j.modules}</p>
            <div className="gates-actions">
              <Link href="/login" className="gates-act">
                {copy.nav.demo}
              </Link>
              <Link href="/login" className="gates-act-ghost">
                {copy.cta.explore}
              </Link>
            </div>
          </>
        }
      />
    </div>
  );
}
