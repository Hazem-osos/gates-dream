'use client';

import { ACADEMY_PROGRAMS, type AcademyProgramId } from '@/lib/onboarding/academyTours';

const STORAGE_KEY = 'gates:academy-progress';

/** Fired whenever local progress changes — used by useAcademyProgressSync to debounce a server PUT. */
export const GATES_ACADEMY_PROGRESS_EVENT = 'gates:academy-progress';

export type AcademyProgressState = {
  completedPrograms: AcademyProgramId[];
  lastUpdated: string;
};

/** All 17 programs (5 legacy + 12 additive) — derived so new tours automatically count toward completion %. */
const ALL_PROGRAMS: AcademyProgramId[] = Object.keys(ACADEMY_PROGRAMS) as AcademyProgramId[];

function isKnownProgram(id: unknown): id is AcademyProgramId {
  return typeof id === 'string' && (ALL_PROGRAMS as string[]).includes(id);
}

export function readAcademyProgress(): AcademyProgressState {
  if (typeof window === 'undefined') {
    return { completedPrograms: [], lastUpdated: '' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedPrograms: [], lastUpdated: '' };
    const parsed = JSON.parse(raw) as AcademyProgressState;
    return {
      completedPrograms: Array.isArray(parsed.completedPrograms)
        ? parsed.completedPrograms.filter(isKnownProgram)
        : [],
      lastUpdated: parsed.lastUpdated ?? '',
    };
  } catch {
    return { completedPrograms: [], lastUpdated: '' };
  }
}

function writeAcademyProgress(next: AcademyProgressState, notify: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (notify) window.dispatchEvent(new CustomEvent(GATES_ACADEMY_PROGRESS_EVENT));
}

export function markAcademyProgramComplete(programId: AcademyProgramId) {
  if (typeof window === 'undefined') return;
  const prev = readAcademyProgress();
  if (prev.completedPrograms.includes(programId)) return;
  const next: AcademyProgressState = {
    completedPrograms: [...prev.completedPrograms, programId],
    lastUpdated: new Date().toISOString(),
  };
  writeAcademyProgress(next, true);
}

/**
 * Merge server-sourced progress (from `advancedSettings.academyProgress`) into the local
 * cache — union of completed programs, keeping the most recent `lastUpdated`. Called once
 * per session by `useAcademyProgressSync` after the settings GET resolves. Does not notify
 * (avoids re-triggering the debounced PUT that would just echo the same data back).
 */
export function hydrateAcademyProgressFromServer(remote: AcademyProgressState | null | undefined) {
  if (typeof window === 'undefined' || !remote) return;
  const local = readAcademyProgress();
  const merged = new Set([...local.completedPrograms, ...(remote.completedPrograms ?? []).filter(isKnownProgram)]);
  const lastUpdated =
    !local.lastUpdated || (remote.lastUpdated && remote.lastUpdated > local.lastUpdated)
      ? remote.lastUpdated
      : local.lastUpdated;
  writeAcademyProgress({ completedPrograms: [...merged], lastUpdated: lastUpdated ?? '' }, false);
}

export function academyProgressPercent(state: AcademyProgressState = readAcademyProgress()): number {
  const done = state.completedPrograms.filter((id) => ALL_PROGRAMS.includes(id)).length;
  return Math.round((done / ALL_PROGRAMS.length) * 100);
}

/** Completion % scoped to a single hub category (e.g. "sales-cashier") — used by the category progress bars. */
export function academyCategoryProgressPercent(
  category: string,
  state: AcademyProgressState = readAcademyProgress()
): number {
  const inCategory = ALL_PROGRAMS.filter((id) => ACADEMY_PROGRAMS[id].category === category);
  if (inCategory.length === 0) return 0;
  const done = inCategory.filter((id) => state.completedPrograms.includes(id)).length;
  return Math.round((done / inCategory.length) * 100);
}

export function academyProgressLabel(state: AcademyProgressState = readAcademyProgress()): string {
  const pct = academyProgressPercent(state);
  return `أكملت ${pct}% من المهارات`;
}
