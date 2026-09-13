/**
 * Explicit Tailwind class strings (JIT-safe — no dynamic interpolation).
 * depth === 0 → root category row; depth >= 1 → neutral child rows.
 * Light-mode only (no dark: variants) so rows stay readable under app dark theme.
 */
export type CoaNodeStyling = {
  row: string;
  text: string;
  badge: string;
};

export function getNodeStyling(code: string, depth: number): CoaNodeStyling {
  if (depth > 0) {
    const isMidLevel = depth === 1;
    return {
      row: isMidLevel
        ? 'bg-slate-50/90 hover:bg-slate-100/80 border-b border-slate-200/70'
        : 'bg-white hover:bg-slate-50/80 border-b border-slate-100',
      text: isMidLevel ? 'text-slate-900 font-semibold' : 'text-slate-800 font-medium',
      badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    };
  }

  const rootDigit = code.trim().charAt(0);
  switch (rootDigit) {
    case '1':
      return {
        row: 'bg-sky-50/80 border border-sky-200/80 hover:bg-sky-100/60',
        text: 'text-sky-950 font-bold',
        badge: 'bg-sky-100 text-sky-800 border border-sky-300',
      };
    case '2':
      return {
        row: 'bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100/60',
        text: 'text-amber-950 font-bold',
        badge: 'bg-amber-100 text-amber-800 border border-amber-300',
      };
    case '3':
      return {
        row: 'bg-purple-50/80 border border-purple-200/80 hover:bg-purple-100/60',
        text: 'text-purple-950 font-bold',
        badge: 'bg-purple-100 text-purple-800 border border-purple-300',
      };
    case '4':
      return {
        row: 'bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100/60',
        text: 'text-emerald-950 font-bold',
        badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      };
    case '5':
      return {
        row: 'bg-rose-50/80 border border-rose-200/80 hover:bg-rose-100/60',
        text: 'text-rose-950 font-bold',
        badge: 'bg-rose-100 text-rose-800 border border-rose-300',
      };
    default:
      return {
        row: 'bg-slate-50 border border-slate-200',
        text: 'text-slate-900 font-bold',
        badge: 'bg-slate-100 text-slate-700 border border-slate-200',
      };
  }
}

/** @deprecated Use getNodeStyling().row */
export function getRootColorClasses(code: string, level: number): string {
  return getNodeStyling(code, level).row;
}

export function getRootIconClass(code: string, depth: number): string {
  if (depth > 0) return 'text-slate-600';

  const rootDigit = code.trim().charAt(0);
  switch (rootDigit) {
    case '1':
      return 'text-sky-700';
    case '2':
      return 'text-amber-700';
    case '3':
      return 'text-purple-700';
    case '4':
      return 'text-emerald-700';
    case '5':
      return 'text-rose-700';
    default:
      return 'text-slate-600';
  }
}

export function depthPaddingClass(): string {
  return '';
}

/** Accent for nested tree guides (matches root category). JIT-safe full class names. */
export function getTreeGuideClasses(rootDigit: string): { border: string; surface: string; elbow: string } {
  switch (rootDigit) {
    case '1':
      return {
        border: 'border-sky-300',
        surface: 'bg-sky-50/40',
        elbow: 'bg-sky-400',
      };
    case '2':
      return {
        border: 'border-amber-300',
        surface: 'bg-amber-50/35',
        elbow: 'bg-amber-400',
      };
    case '3':
      return {
        border: 'border-purple-300',
        surface: 'bg-purple-50/35',
        elbow: 'bg-purple-400',
      };
    case '4':
      return {
        border: 'border-emerald-300',
        surface: 'bg-emerald-50/35',
        elbow: 'bg-emerald-400',
      };
    case '5':
      return {
        border: 'border-rose-300',
        surface: 'bg-rose-50/35',
        elbow: 'bg-rose-400',
      };
    default:
      return {
        border: 'border-slate-300',
        surface: 'bg-slate-50/60',
        elbow: 'bg-slate-400',
      };
  }
}

export function depthLevelLabel(depth: number): string | null {
  if (depth <= 0) return null;
  return `م${depth + 1}`;
}

