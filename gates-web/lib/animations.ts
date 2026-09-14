'use client';

/** Shared easing / scene durations. Section timelines keep their own keyframes. */
export const EASE = {
  editorial: 'power3.out',
  precise: 'power2.inOut',
  industrial: 'none',
} as const;

export const CONNECTED = {
  desktopVh: 280,
  mobileVh: 220,
} as const;

export const TRANSACTION = {
  desktopVh: 240,
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

/** First cinematic act: intro → sale → inventory → accounting → system reveal. */
export const OPENING = {
  desktopVh: 860,
  mobileVh: 680,
  phases: {
    introEnd: 0.12,
    saleEnd: 0.34,
    inventoryEnd: 0.54,
    accountingEnd: 0.72,
    revealEnd: 1,
  },
} as const;

/** Second act: enter GATES → product camera → HQ → locations. Stops before Egypt map. */
export const PRODUCT_SCALE = {
  desktopVh: 740,
  mobileVh: 580,
  phases: {
    enterEnd: 0.14,
    dashSettleEnd: 0.28,
    salesEnd: 0.42,
    inventoryEnd: 0.56,
    accountingEnd: 0.70,
    understandEnd: 0.80,
    hqEnd: 0.88,
    locationsEnd: 1,
  },
} as const;

/** Third act: after the connected sale — retail, briefing, draft, live network. */
export const COMPANY_STORY = {
  desktopVh: 660,
  mobileVh: 520,
  phases: {
    holdEnd: 0.03,
    retailEnd: 0.12,
    tokenEnd: 0.26,
    briefingEnd: 0.33,
    investigateEnd: 0.48,
    draftEnd: 0.6,
    purchaseEnd: 0.71,
    decisionEnd: 0.79,
    networkEnd: 0.91,
    osEnd: 1,
  },
} as const;

export const HERO = {
  desktopVh: 420,
  mobileVh: 280,
  /** Scroll ranges as fractions of the hero pin — one master GSAP timeline. */
  phases: {
    /** 0–12%: headline + partially assembled platform. */
    stillEnd: 0.12,
    /** 12–38%: module panels arrive as UI layers. */
    dockEnd: 0.38,
    /** 38–58%: panels assemble into one interface. */
    compressEnd: 0.58,
    /** 58–88%: assembled system becomes a production dashboard. */
    dashboardEnd: 0.88,
    finish: 1,
  },
} as const;

export function emitNavTheme(theme: 'light' | 'dark') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gates-nav-theme', { detail: theme }));
}

export type GatesNavThemeDetail = 'light' | 'dark';
