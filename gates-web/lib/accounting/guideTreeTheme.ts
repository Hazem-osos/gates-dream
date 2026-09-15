/** Softer tree accents for master guides (cost centers, delegates). JIT-safe classes. */

export type SoftGuideTone = {
  border: string;
  surface: string;
  elbow: string;
  row: string;
  text: string;
  badge: string;
  icon: string;
};

const TONES: SoftGuideTone[] = [
  {
    border: 'border-sky-200',
    surface: 'bg-sky-50/45',
    elbow: 'bg-sky-300',
    row: 'bg-sky-50/75 border border-sky-100 hover:bg-sky-50',
    text: 'text-sky-950 font-bold',
    badge: 'bg-sky-50 text-sky-700 border border-sky-200',
    icon: 'text-sky-600',
  },
  {
    border: 'border-teal-200',
    surface: 'bg-teal-50/45',
    elbow: 'bg-teal-300',
    row: 'bg-teal-50/75 border border-teal-100 hover:bg-teal-50',
    text: 'text-teal-950 font-bold',
    badge: 'bg-teal-50 text-teal-700 border border-teal-200',
    icon: 'text-teal-600',
  },
  {
    border: 'border-amber-200',
    surface: 'bg-amber-50/45',
    elbow: 'bg-amber-300',
    row: 'bg-amber-50/75 border border-amber-100 hover:bg-amber-50',
    text: 'text-amber-950 font-bold',
    badge: 'bg-amber-50 text-amber-800 border border-amber-200',
    icon: 'text-amber-600',
  },
  {
    border: 'border-violet-200',
    surface: 'bg-violet-50/45',
    elbow: 'bg-violet-300',
    row: 'bg-violet-50/75 border border-violet-100 hover:bg-violet-50',
    text: 'text-violet-950 font-bold',
    badge: 'bg-violet-50 text-violet-700 border border-violet-200',
    icon: 'text-violet-600',
  },
  {
    border: 'border-rose-200',
    surface: 'bg-rose-50/45',
    elbow: 'bg-rose-300',
    row: 'bg-rose-50/75 border border-rose-100 hover:bg-rose-50',
    text: 'text-rose-950 font-bold',
    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
    icon: 'text-rose-600',
  },
  {
    border: 'border-slate-200',
    surface: 'bg-slate-50/60',
    elbow: 'bg-slate-300',
    row: 'bg-slate-50 border border-slate-200 hover:bg-slate-100/70',
    text: 'text-slate-900 font-bold',
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    icon: 'text-slate-600',
  },
];

export function getSoftGuideTone(index: number): SoftGuideTone {
  const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return TONES[safe % TONES.length];
}

export function resolveGuideToneIndex(code: string | null | undefined, fallbackIndex: number): number {
  const digit = String(code ?? '').trim().charAt(0);
  if (digit >= '1' && digit <= '9') return Number(digit) - 1;
  if (/[a-zA-Z]/.test(digit)) return (digit.toUpperCase().charCodeAt(0) - 65) % TONES.length;
  return fallbackIndex;
}
