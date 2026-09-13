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
  desktopVh: 380,
  mobileVh: 210,
  /** Scroll ranges as fractions of the hero pin (one timeline). */
  phases: {
    stillEnd: 0.1,
    travelEnd: 0.4,
    connectEnd: 0.56,
    coreEnd: 0.7,
    settleEnd: 0.84,
    finish: 1,
  },
} as const;

export function emitNavTheme(theme: 'light' | 'dark') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gates-nav-theme', { detail: theme }));
}

export type GatesNavThemeDetail = 'light' | 'dark';
