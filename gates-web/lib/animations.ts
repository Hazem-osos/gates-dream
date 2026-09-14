'use client';

/** Shared easing / scene durations. Section timelines keep their own keyframes. */
export const EASE = {
  editorial: 'power3.out',
  precise: 'power2.inOut',
  industrial: 'none',
} as const;

export const CONNECTED = {
  desktopVh: 280,
  mobileVh: 200,
} as const;

export const TRANSACTION = {
  desktopVh: 300,
  mobileVh: 200,
} as const;

export const STORY = {
  desktopVh: 260,
  mobileVh: 190,
} as const;

export const NETWORK = {
  desktopVh: 360,
  mobileVh: 230,
} as const;

export const GATES_AI = {
  desktopVh: 280,
  mobileVh: 200,
} as const;

export const HERO = {
  desktopVh: 400,
  mobileVh: 260,
  /** Scroll ranges as fractions of the hero pin — one master GSAP timeline. */
  phases: {
    /** 0–12%: white stage, headline, inactive Gates Engine. */
    stillEnd: 0.12,
    /** 12–63%: modules travel + dock one at a time (per-module phases live in data/modules.ts). */
    dockEnd: 0.63,
    /** 63–72%: modules compress toward the core into one connected machine. */
    compressEnd: 0.72,
    /** 72–82%: 2.5D rotate/scale reveal of the GATES word behind the machine. */
    rotateEnd: 0.82,
    /** 82–92%: machine morphs into the browser-like ERP dashboard. */
    dashboardEnd: 0.92,
    finish: 1,
  },
} as const;

export function emitNavTheme(theme: 'light' | 'dark') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gates-nav-theme', { detail: theme }));
}

export type GatesNavThemeDetail = 'light' | 'dark';
