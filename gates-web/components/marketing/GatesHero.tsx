'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMarketingLocale } from '../../lib/marketing/locale';
import './gates-hero.css';

const VIDEO_SRC =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/24f3c998-86fb-4f1d-9906-07c7fa740f8a.mp4';

const ZONES = [
  { id: 'ai', x: 0.5, y: 0.22, theme: 'cyan' },
  { id: 'sales', x: 0.36, y: 0.3, theme: 'magenta' },
  { id: 'crm', x: 0.64, y: 0.28, theme: 'violet' },
  { id: 'purchasing', x: 0.82, y: 0.24, theme: 'amber' },
  { id: 'finance', x: 0.18, y: 0.4, theme: 'ice' },
  { id: 'inventory', x: 0.82, y: 0.4, theme: 'lime' },
  { id: 'invoices', x: 0.16, y: 0.54, theme: 'violet' },
  { id: 'treasury', x: 0.84, y: 0.52, theme: 'cyan' },
  { id: 'contracting', x: 0.28, y: 0.58, theme: 'amber' },
  { id: 'hr', x: 0.18, y: 0.68, theme: 'magenta' },
  { id: 'pos', x: 0.82, y: 0.66, theme: 'lime' },
  { id: 'reports', x: 0.18, y: 0.78, theme: 'ice' },
  { id: 'manufacturing', x: 0.28, y: 0.8, theme: 'cyan' },
  { id: 'payroll', x: 0.4, y: 0.8, theme: 'violet' },
  { id: 'branches', x: 0.58, y: 0.8, theme: 'ice' },
  { id: 'warehouse', x: 0.72, y: 0.78, theme: 'lime' },
  { id: 'projects', x: 0.36, y: 0.86, theme: 'amber' },
  { id: 'ops', x: 0.66, y: 0.86, theme: 'cyan' },
] as const;

function cardPlace(x: number, y: number) {
  if (x <= 0.28) return 'right';
  if (x >= 0.72) return 'left';
  if (y >= 0.74) return 'up';
  return 'in';
}

const THEME_COLOR: Record<(typeof ZONES)[number]['theme'], string> = {
  cyan: '#38bdf8',
  violet: '#c084fc',
  magenta: '#f472b6',
  ice: '#67e8f9',
  lime: '#86efac',
  amber: '#fcd34d',
};

function padNode(index: number) {
  return `NODE ${String(index + 1).padStart(2, '0')}`;
}

function bindHeroVideo(v: HTMLVideoElement) {
  const SENSITIVITY = 0.8;
  const EPSILON = 0.04;
  let prevX: number | null = null;
  let targetTime = 0;
  let seeking = false;
  let requested = -1;

  const duration = () => {
    const d = v.duration;
    return Number.isFinite(d) && d > 0 ? d : 0;
  };
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  let seekWatch = 0;
  const pump = () => {
    if (Math.abs(targetTime - v.currentTime) < EPSILON) return;
    if (seeking) return;
    seeking = true;
    requested = targetTime;
    window.clearTimeout(seekWatch);
    seekWatch = window.setTimeout(() => {
      seeking = false;
      pump();
    }, 80);
    try {
      v.currentTime = targetTime;
    } catch {
      seeking = false;
    }
  };

  const onSeeked = () => {
    window.clearTimeout(seekWatch);
    seeking = false;
    if (targetTime !== requested) pump();
  };
  const reanchor = () => {
    prevX = null;
  };

  v.pause();
  const anchor = () => {
    targetTime = v.currentTime;
    if (!v.currentTime) v.currentTime = 0.001;
  };
  v.addEventListener('loadeddata', anchor, { once: true });
  if (v.readyState >= 2) anchor();
  v.addEventListener('seeked', onSeeked);
  document.addEventListener('mouseleave', reanchor);
  window.addEventListener('blur', reanchor);
  document.addEventListener('visibilitychange', reanchor);

  let onCanPlay: (() => void) | null = null;
  let onMove: ((event: MouseEvent) => void) | null = null;

  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
      return () => {
        v.removeEventListener('seeked', onSeeked);
        document.removeEventListener('mouseleave', reanchor);
        window.removeEventListener('blur', reanchor);
        document.removeEventListener('visibilitychange', reanchor);
      };
    }
  } catch {
    /* ignore */
  }

  try {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) {
      onCanPlay = () => {
        const play = v.play();
        if (play?.catch) void play.catch(() => undefined);
      };
      v.addEventListener('canplay', onCanPlay, { once: true });
      return () => {
        if (onCanPlay) v.removeEventListener('canplay', onCanPlay);
        v.removeEventListener('seeked', onSeeked);
        document.removeEventListener('mouseleave', reanchor);
        window.removeEventListener('blur', reanchor);
        document.removeEventListener('visibilitychange', reanchor);
      };
    }
  } catch {
    /* ignore */
  }

  onMove = (event: MouseEvent) => {
    const d = duration();
    if (prevX === null || !d) {
      prevX = event.clientX;
      return;
    }
    const delta = prevX - event.clientX;
    prevX = event.clientX;
    if (!delta) return;
    targetTime = clamp(targetTime + (delta / window.innerWidth) * SENSITIVITY * d, 0, d);
    pump();
  };
  window.addEventListener('mousemove', onMove, { passive: true });

  return () => {
    window.clearTimeout(seekWatch);
    if (onMove) window.removeEventListener('mousemove', onMove);
    v.removeEventListener('seeked', onSeeked);
    document.removeEventListener('mouseleave', reanchor);
    window.removeEventListener('blur', reanchor);
    document.removeEventListener('visibilitychange', reanchor);
  };
}

export function GatesHero() {
  const { copy, dir } = useMarketingLocale();
  const frame = copy.heroFrame;
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    window.dispatchEvent(new CustomEvent('gates-nav-theme', { detail: 'light' }));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return bindHeroVideo(video);
  }, [mounted]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const pickZone = (clientX: number, clientY: number) => {
      const box = root.getBoundingClientRect();
      const x = (clientX - box.left) / box.width;
      const y = (clientY - box.top) / box.height;
      let best: (typeof ZONES)[number] | null = null;
      let bestDist = 0.2;
      for (const zone of ZONES) {
        const dist = Math.hypot(zone.x - x, zone.y - y);
        if (dist < bestDist) {
          best = zone;
          bestDist = dist;
        }
      }
      setActiveId(best?.id ?? null);
    };

    const onMove = (event: MouseEvent) => pickZone(event.clientX, event.clientY);
    const onLeave = () => setActiveId(null);
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseleave', onLeave);
    return () => {
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section ref={rootRef} className="gates-hero" dir={dir} aria-label={copy.wordmark}>
      <p className="gates-hero-word" aria-hidden="true">
        GATES
      </p>

      <div className="gates-hero-figure" role="img" aria-label={frame.figureAria}>
        {mounted ? (
          <video
            ref={videoRef}
            muted
            playsInline
            loop
            preload="metadata"
            disablePictureInPicture
            tabIndex={-1}
            aria-hidden="true"
            src={VIDEO_SRC}
            suppressHydrationWarning
          />
        ) : null}
      </div>

      {ZONES.map((zone, index) => {
        const feature = frame.features.find((item) => item.id === zone.id);
        if (!feature) return null;
        const on = activeId === zone.id;
        return (
          <div
            key={zone.id}
            className="gates-hero-pin hidden md:block"
            style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%` }}
          >
            <span
              className="gates-hero-node"
              data-on={on}
              data-skin={['hex', 'ring', 'plus', 'diamond'][index % 4]}
              style={{ color: THEME_COLOR[zone.theme] }}
            >
              <i />
              <i />
              <i />
            </span>
            {on ? (
              <article className="gates-hero-card" data-theme={zone.theme} data-place={cardPlace(zone.x, zone.y)}>
                <span className="visor" aria-hidden="true" />
                <div className="copy">
                  <div className="meta">
                    <span>{padNode(index)}</span>
                    <span>LIVE</span>
                  </div>
                  <p className="kicker">{feature.title}</p>
                  <p className="body">{feature.body}</p>
                  <p className="foot">GATES NEURAL</p>
                </div>
              </article>
            ) : null}
          </div>
        );
      })}

      <div className="gates-hero-intro">
        <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-[#0b6fa4]">{frame.eyebrow}</p>
        <h1 className="mt-2 text-[clamp(1.7rem,3.4vw,2.7rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#071b2b]">
          {frame.headline}
        </h1>
        <p className="mt-3 max-w-sm text-[0.95rem] leading-6 text-[#071b2b]/65">{frame.blurb}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex rounded-full bg-[#071b2b] px-4 py-2 text-[0.75rem] font-medium text-[#7dd3fc] shadow-[0_0_24px_rgba(56,189,248,0.25)] transition hover:bg-[#0b2d44]"
          >
            {frame.enter}
          </Link>
          <p className="text-[0.75rem] text-[#071b2b]/40">{frame.hint}</p>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex gap-3 overflow-x-auto px-5 pb-6 pt-10 md:hidden">
        {ZONES.map((zone, index) => {
          const feature = frame.features.find((item) => item.id === zone.id);
          if (!feature) return null;
          return (
            <article key={zone.id} className="gates-hero-card min-w-[17rem] shrink-0" data-theme={zone.theme}>
              <span className="visor" aria-hidden="true" />
              <div className="copy">
                <div className="meta">
                  <span>{padNode(index)}</span>
                  <span>LIVE</span>
                </div>
                <p className="kicker">{feature.title}</p>
                <p className="body">{feature.body}</p>
                <p className="foot">GATES NEURAL</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
