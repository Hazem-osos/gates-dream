'use client';

import { create } from 'zustand';
import type { AcademyProgramId } from '@/lib/onboarding/academyTours';

/**
 * Additive status store for the Gates Academy tour engine. This does NOT
 * replace `ProductTourProvider`'s driver.js orchestration — it is populated
 * FROM that provider's existing lifecycle callbacks (driver create/destroy,
 * checkpoint/trigger satisfied, cross-route navigate) so UI (sandbox banner,
 * resume pill, hub progress) has a single deterministic source of truth to
 * read from without reaching into refs.
 */
export type AcademyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'WAITING_USER_ACTION' | 'COMPLETED';

export type AcademyStoreState = {
  status: AcademyStatus;
  activeProgramId: AcademyProgramId | null;
  activeStepIndex: number;
  totalSteps: number;
  completionPercent: number;
  sandboxActive: boolean;
  /** Id of the trigger the current step is blocked on, or null if none. */
  pendingTriggerId: string | null;

  start: (programId: AcademyProgramId, totalSteps: number, sandboxActive?: boolean) => void;
  setStep: (index: number, totalSteps?: number) => void;
  setWaitingForTrigger: (triggerId: string | null) => void;
  pause: () => void;
  resume: () => void;
  complete: () => void;
  reset: () => void;
  setSandboxActive: (active: boolean) => void;
  setCompletionPercent: (pct: number) => void;
};

export const useAcademyStore = create<AcademyStoreState>((set) => ({
  status: 'IDLE',
  activeProgramId: null,
  activeStepIndex: 0,
  totalSteps: 0,
  completionPercent: 0,
  sandboxActive: false,
  pendingTriggerId: null,

  start: (programId, totalSteps, sandboxActive = false) =>
    set({
      status: 'RUNNING',
      activeProgramId: programId,
      activeStepIndex: 0,
      totalSteps,
      sandboxActive,
      pendingTriggerId: null,
    }),

  setStep: (index, totalSteps) =>
    set((s) => ({
      activeStepIndex: index,
      totalSteps: totalSteps ?? s.totalSteps,
      status: s.status === 'PAUSED' ? s.status : s.pendingTriggerId ? 'WAITING_USER_ACTION' : 'RUNNING',
    })),

  setWaitingForTrigger: (triggerId) =>
    set((s) => ({
      pendingTriggerId: triggerId,
      status: s.status === 'PAUSED' ? s.status : triggerId ? 'WAITING_USER_ACTION' : 'RUNNING',
    })),

  pause: () => set({ status: 'PAUSED' }),

  resume: () => set((s) => ({ status: s.pendingTriggerId ? 'WAITING_USER_ACTION' : 'RUNNING' })),

  complete: () =>
    set({ status: 'COMPLETED', pendingTriggerId: null, sandboxActive: false }),

  reset: () =>
    set({
      status: 'IDLE',
      activeProgramId: null,
      activeStepIndex: 0,
      totalSteps: 0,
      pendingTriggerId: null,
      sandboxActive: false,
    }),

  setSandboxActive: (active) => set({ sandboxActive: active }),
  setCompletionPercent: (pct) => set({ completionPercent: pct }),
}));

/** Imperative helper for non-React call sites (event listeners, driver.js callbacks). */
export function getAcademyStoreState() {
  return useAcademyStore.getState();
}
