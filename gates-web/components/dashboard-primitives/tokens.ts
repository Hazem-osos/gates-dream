/** Shared fintech surface tokens for module command centers. */
export const DASH_PAGE =
  'min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-slate-950 dark:text-slate-100';
export const DASH_SHELL = 'w-full max-w-none px-4 py-5 sm:px-6';
export const DASH_SHADOW = 'shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)]';
export const DASH_PANEL = `rounded-xl border border-slate-200/75 bg-white dark:border-slate-800 dark:bg-slate-900 ${DASH_SHADOW}`;
export const DASH_NUM = 'font-mono tabular-nums tracking-tight';
export const DASH_LABEL = 'text-xs font-medium tracking-wide text-slate-500';
export const DASH_VALUE = 'text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums dark:text-slate-100';
export const DASH_ROW =
  'border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50';
export const DASH_CHIP =
  'inline-flex h-5 items-center rounded-full border border-slate-200/80 bg-slate-50 px-2 font-mono text-[10px] tabular-nums text-slate-600 dark:border-slate-700';
export const DASH_KEY =
  'inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-semibold text-slate-600';
export const DASH_GRID = 'mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3';
export const DASH_BRAND = '#0E79AA';

/** Shared toolbar chips for command-center HUDs (shortcuts, filters, refresh). */
export const HUD_BTN =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full px-3.5 text-[12px] font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E79AA]/35 focus-visible:ring-offset-1';
export const HUD_BTN_GHOST = `${HUD_BTN} border border-slate-200/80 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#0E79AA]/30 hover:bg-[#F0F9FC] hover:text-[#0B6A96]`;
export const HUD_BTN_PRIMARY = `${HUD_BTN} border border-transparent bg-gradient-to-b from-[#1594C7] to-[#0C6A95] text-white shadow-[0_2px_8px_rgba(14,121,170,0.28)] hover:from-[#0E79AA] hover:to-[#0A5578]`;
export const HUD_KBD =
  'inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded-md px-1.5 font-mono text-[10px] font-semibold tracking-wide';
export const HUD_KBD_ON_PRIMARY = `${HUD_KBD} bg-white/18 text-white`;
export const HUD_KBD_ON_GHOST = `${HUD_KBD} bg-slate-100 text-slate-500`;
export const HUD_SEGMENT =
  'inline-flex h-9 items-center rounded-full bg-slate-100/90 p-0.5 ring-1 ring-inset ring-slate-200/80';
export const HUD_SEGMENT_ITEM =
  'inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-medium transition-all duration-200';
export const HUD_SEGMENT_ON = `${HUD_SEGMENT_ITEM} bg-white text-[#0B6A96] shadow-[0_1px_3px_rgba(15,23,42,0.08)]`;
export const HUD_SEGMENT_OFF = `${HUD_SEGMENT_ITEM} text-slate-500 hover:text-slate-700`;
