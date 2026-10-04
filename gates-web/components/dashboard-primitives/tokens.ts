/** Shared fintech surface tokens for module command centers. */
export const DASH_PAGE = 'min-h-full bg-transparent text-foreground';
export const DASH_SHELL = 'w-full max-w-none px-1 py-2 sm:px-2';
export const DASH_SHADOW = 'shadow-subtle';
export const DASH_PANEL = `rounded-xl border border-border bg-surface-1 ${DASH_SHADOW}`;
export const DASH_NUM = 'font-mono tabular-nums tracking-tight';
export const DASH_LABEL = 'text-xs font-medium tracking-wide text-foreground-muted';
export const DASH_VALUE =
  'text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums';
export const DASH_ROW =
  'border-b border-border last:border-0 hover:bg-surface-hover';
export const DASH_CHIP =
  'inline-flex h-5 items-center rounded-full border border-border bg-surface-2 px-2 font-mono text-[10px] tabular-nums text-foreground-muted';
export const DASH_KEY =
  'inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] font-semibold text-foreground-muted';
export const DASH_GRID = 'mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3';
export const DASH_BRAND = '#0E78AA';

export const HUD_BTN =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full px-3.5 text-[12px] font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background';
export const HUD_BTN_GHOST = `${HUD_BTN} border border-border bg-surface-1 text-foreground-muted shadow-subtle hover:border-primary/30 hover:bg-surface-hover hover:text-primary`;
export const HUD_BTN_PRIMARY = `${HUD_BTN} border border-transparent bg-primary text-primary-foreground shadow-subtle hover:bg-primary-hover`;
export const HUD_KBD =
  'inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded-md px-1.5 font-mono text-[10px] font-semibold tracking-wide';
export const HUD_KBD_ON_PRIMARY = `${HUD_KBD} bg-white/18 text-white`;
export const HUD_KBD_ON_GHOST = `${HUD_KBD} bg-surface-2 text-foreground-muted`;
export const HUD_SEGMENT = 'inline-flex h-9 items-center rounded-full bg-surface-2 p-0.5 ring-1 ring-inset ring-border';
export const HUD_SEGMENT_ITEM =
  'inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-medium transition-all duration-200';
export const HUD_SEGMENT_ON = `${HUD_SEGMENT_ITEM} bg-surface-1 text-primary shadow-subtle`;
export const HUD_SEGMENT_OFF = `${HUD_SEGMENT_ITEM} text-foreground-muted hover:text-foreground`;
