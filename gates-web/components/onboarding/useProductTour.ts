'use client';

import { type DriveStep, type Driver } from 'driver.js';
import type { AcademyProgram, AcademyStepMeta } from '@/lib/onboarding/academyTours';
import { getAcademyProgram } from '@/lib/onboarding/academyTours';
import {
  applyTourSpotlight,
  clearTourBodyClass,
  forceDriverDomCleanup,
  decorateTourPopover,
  type TourPopoverExtras,
} from '@/components/onboarding/TourPopover';
import {
  applyTourPopoverPosition,
  stepSelectorAtIndex,
  stepPopoverPlacementAtIndex,
} from '@/components/onboarding/tourPopoverPosition';
import {
  GATES_ACADEMY_CHECKPOINT_EVENT,
  GATES_ACADEMY_OPEN_MODULE_MENU_EVENT,
  GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT,
  GATES_ACADEMY_TRIGGER_EVENT,
  dispatchAcademyPrepareStep,
  type AcademyCheckpointDetail,
  type AcademyTriggerDetail,
} from '@/lib/onboarding/tourCheckpoints';
import { pathnameMatchesTourRoute, scrollTourTargetIntoViewCenter } from '@/lib/onboarding/tourEngine';
import { resolveTourTarget } from '@/components/onboarding/tourPopoverPosition';
import { getAcademyStoreState } from '@/lib/onboarding/academyStore';

/** @deprecated Use ACADEMY_PROGRAMS.foundation-8 */
export const PRODUCT_TOUR_STEPS: DriveStep[] = [];

export type CreateAcademyDriverOptions = {
  program: AcademyProgram;
  pathname: string | null;
  startProgramStepIndex: number;
  /** Canonical program step (survives route-scoped driver steps). */
  getProgramStepIndex: () => number;
  setProgramStepIndex: (index: number) => void;
  onDestroyStarted?: () => void;
  onStepCheckpointSatisfied?: (stepIndex: number) => void;
  onRequestNavigate?: (stepIndex: number, route: string) => void;
  getCheckpointSatisfied?: (stepIndex: number) => boolean;
  setCheckpointSatisfied?: (stepIndex: number, value: boolean) => void;
  onActiveStep?: (stepIndex: number) => void;
  onTourComplete?: () => void;
};

export type CreateProductTourDriverOptions = {
  onDestroyStarted?: () => void;
};

function mapStepElement(step: DriveStep): DriveStep {
  const el = step.element;
  if (typeof el !== 'string') return step;
  const selector = el;
  return {
    ...step,
    element: () => {
      const resolved = resolveTourTarget(selector);
      return (
        (resolved as HTMLElement | null) ??
        (document.querySelector(selector) as HTMLElement | null)
      );
    },
  };
}

function buildRouteScopedSteps(
  program: AcademyProgram,
  pathname: string | null
): { steps: DriveStep[]; programStepIndices: number[] } {
  const steps: DriveStep[] = [];
  const programStepIndices: number[] = [];
  for (let i = 0; i < program.steps.length; i += 1) {
    const route = program.meta[i]?.route;
    if (!route || !pathnameMatchesTourRoute(pathname, route)) continue;
    steps.push(mapStepElement(program.steps[i]!));
    programStepIndices.push(i);
  }
  if (steps.length > 0) return { steps, programStepIndices };
  return {
    steps: program.steps.map((s) => mapStepElement(s)),
    programStepIndices: program.steps.map((_, i) => i),
  };
}

export async function createAcademyDriver(options: CreateAcademyDriverOptions): Promise<Driver> {
  await import('driver.js/dist/driver.css');
  const { driver } = await import(/* webpackChunkName: "driver-js" */ 'driver.js');
  const program = options.program;
  const meta = program.meta;
  const totalProgramSteps = program.steps.length;
  const { steps: routeScopedSteps, programStepIndices } = buildRouteScopedSteps(
    program,
    options.pathname
  );

  let repositionCleanup: (() => void) | null = null;
  let checkpointCleanup: (() => void) | null = null;
  let triggerCleanup: (() => void) | null = null;
  let keyboardCleanup: (() => void) | null = null;
  let activeDriver: Driver | null = null;

  const getMeta = (index: number): AcademyStepMeta | undefined => meta[index];

  const programStepFromLocal = (localIndex: number) =>
    programStepIndices[localIndex] ?? options.getProgramStepIndex();

  const isProgramLastStep = (programStep: number) => programStep >= totalProgramSteps - 1;

  const completeTour = (d: Driver) => {
    getAcademyStoreState().complete();
    options.onTourComplete?.();
    d.destroy();
  };

  const bindKeyboard = (d: Driver) => {
    keyboardCleanup?.();
    const onKey = (e: KeyboardEvent) => {
      if (!d.isActive()) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const programStep = options.getProgramStepIndex();
      if (e.key === 'Escape') {
        e.preventDefault();
        d.destroy();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isProgramLastStep(programStep)) completeTour(d);
        else void tryAdvance(d, programStep);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!d.isFirstStep()) d.movePrevious();
      }
    };
    window.addEventListener('keydown', onKey);
    keyboardCleanup = () => window.removeEventListener('keydown', onKey);
  };

  const refreshDriverStage = () => {
    window.setTimeout(() => {
      try {
        activeDriver?.refresh();
      } catch {
        /* ignore */
      }
    }, 120);
    window.setTimeout(() => {
      try {
        activeDriver?.refresh();
      } catch {
        /* ignore */
      }
    }, 400);
  };

  const scheduleReposition = (programStep: number) => {
    const run = () => repositionToProgramStep(programStep);
    requestAnimationFrame(run);
    window.setTimeout(run, 160);
  };

  const PAGE_SCROLL_STEP_IDS = new Set([
    'coa',
    'invoice-grid',
    'jit-modals',
    'impact-tabs',
    'sentinel',
    'inv-search',
    'inv-movements',
    'inv-matrix',
    'inv-reorder',
    'dash-profit',
    'dash-treasury',
    'dash-digest',
    'sales-customer',
    'sales-grid',
    'sales-tafqeet',
  ]);

  const repositionToProgramStep = (programStep: number) => {
    const wrapper = document.querySelector<HTMLElement>('.gates-tour-popover.driver-popover');
    const selector = stepSelectorAtIndex(program.steps, programStep);
    if (wrapper && selector) {
      applyTourPopoverPosition(
        wrapper,
        selector,
        stepPopoverPlacementAtIndex(program.steps, programStep)
      );
    }
  };

  const bindRepositionListeners = () => {
    repositionCleanup?.();
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        repositionToProgramStep(options.getProgramStepIndex());
      });
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    repositionCleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  };

  const clearCheckpointListeners = () => {
    checkpointCleanup?.();
    checkpointCleanup = null;
  };

  const bindCheckpointListeners = (programStep: number, d: Driver) => {
    clearCheckpointListeners();
    const stepMeta = getMeta(programStep);
    if (!stepMeta?.checkpoint) return;

    const onCheckpoint = (ev: Event) => {
      const detail = (ev as CustomEvent<AcademyCheckpointDetail>).detail;
      if (detail?.type !== stepMeta.checkpoint) return;
      options.setCheckpointSatisfied?.(programStep, true);
      options.onStepCheckpointSatisfied?.(programStep);
      window.setTimeout(() => {
        if (!d.isActive()) return;
        if (isProgramLastStep(programStep)) completeTour(d);
        else void tryAdvance(d, programStep);
      }, 400);
    };

    window.addEventListener(GATES_ACADEMY_CHECKPOINT_EVENT, onCheckpoint as EventListener);
    checkpointCleanup = () => {
      window.removeEventListener(GATES_ACADEMY_CHECKPOINT_EVENT, onCheckpoint as EventListener);
    };
  };

  const clearTriggerListener = () => {
    triggerCleanup?.();
    triggerCleanup = null;
  };

  const setAwaitingTriggerGlow = (active: boolean) => {
    document.querySelectorAll('.gates-tour-spotlight').forEach((node) => {
      node.classList.toggle('gates-academy-awaiting-trigger', active);
    });
  };

  /** Additive analogue of bindCheckpointListeners for the generic trigger registry. */
  const bindTriggerListener = (programStep: number, d: Driver) => {
    clearTriggerListener();
    const stepMeta = getMeta(programStep);
    const expected = stepMeta?.trigger;
    if (!expected) {
      getAcademyStoreState().setWaitingForTrigger(null);
      setAwaitingTriggerGlow(false);
      return;
    }
    getAcademyStoreState().setWaitingForTrigger(expected.id);
    setAwaitingTriggerGlow(true);

    const onTrigger = (ev: Event) => {
      const detail = (ev as CustomEvent<AcademyTriggerDetail>).detail;
      if (!detail || detail.id !== expected.id || detail.kind !== expected.kind) return;
      getAcademyStoreState().setWaitingForTrigger(null);
      setAwaitingTriggerGlow(false);
      window.setTimeout(() => {
        if (!d.isActive()) return;
        if (isProgramLastStep(programStep)) completeTour(d);
        else void tryAdvance(d, programStep);
      }, 300);
    };

    window.addEventListener(GATES_ACADEMY_TRIGGER_EVENT, onTrigger as EventListener);
    triggerCleanup = () => {
      window.removeEventListener(GATES_ACADEMY_TRIGGER_EVENT, onTrigger as EventListener);
    };
  };

  const tryAdvance = (d: Driver, programStep: number) => {
    const stepMeta = getMeta(programStep);
    const nextIndex = programStep + 1;
    const nextMeta = getMeta(nextIndex);
    if (nextMeta && stepMeta && nextMeta.route !== stepMeta.route) {
      options.onRequestNavigate?.(nextIndex, nextMeta.route);
      d.destroy();
      return true;
    }

    if (isProgramLastStep(programStep)) {
      completeTour(d);
      return true;
    }
    d.moveNext();
    return true;
  };

  const drv = driver({
    steps: routeScopedSteps,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayColor: 'rgba(15, 23, 42, 0.38)',
    overlayOpacity: 1,
    stagePadding: 12,
    stageRadius: 12,
    popoverClass: 'gates-tour-popover',
    popoverOffset: 0,
    skipMissingElement: true,
    showProgress: false,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'التالي',
    prevBtnText: 'السابق',
    doneBtnText: 'انطلاق 🚀',
    onNextClick: (_element, _step, { driver: d }) => {
      const programStep = options.getProgramStepIndex();
      if (isProgramLastStep(programStep)) {
        completeTour(d);
        return;
      }
      void tryAdvance(d, programStep);
    },
    onPrevClick: (_element, _step, { driver: d }) => {
      d.movePrevious();
    },
    onCloseClick: (_element, _step, { driver: d }) => {
      d.destroy();
    },
    onDoneClick: (_element, _step, { driver: d }) => {
      completeTour(d);
    },
    onPopoverRender: (popover, opts) => {
      const localIdx = opts.state.activeIndex ?? 0;
      const programStep = programStepFromLocal(localIdx);
      options.setProgramStepIndex(programStep);
      const stepMeta = getMeta(programStep);
      const extras: TourPopoverExtras = {
        stationTitle: stepMeta?.stationTitle,
        checkpointPrompt:
          (stepMeta?.checkpoint && !options.getCheckpointSatisfied?.(programStep)
            ? stepMeta.checkpointPrompt
            : undefined) ?? stepMeta?.trigger?.prompt,
        programStepIndex: programStep,
        totalProgramSteps,
        programSteps: program.steps,
      };
      decorateTourPopover(popover, opts, extras);
      popover.wrapper.dataset.gatesTourStep = String(programStep);
      bindRepositionListeners();
      scheduleReposition(programStep);
    },
    onHighlighted: (element, _step, opts) => {
      const localIdx = opts.state.activeIndex ?? opts.index ?? 0;
      const programStep = programStepFromLocal(localIdx);
      options.setProgramStepIndex(programStep);
      const stepMeta = getMeta(programStep);
      if (stepMeta?.id) {
        dispatchAcademyPrepareStep(stepMeta.id);
      }
      getAcademyStoreState().setStep(programStep, totalProgramSteps);
      document.querySelectorAll('.gates-tour-spotlight').forEach((node) => {
        node.classList.remove('gates-tour-spotlight');
      });
      applyTourSpotlight(element, true);
      refreshDriverStage();
      options.onActiveStep?.(programStep);
      if (stepMeta?.id === 'module-nav') {
        window.dispatchEvent(new CustomEvent(GATES_ACADEMY_OPEN_MODULE_MENU_EVENT));
      } else {
        window.dispatchEvent(new CustomEvent(GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT));
      }
      if (stepMeta?.id && PAGE_SCROLL_STEP_IDS.has(stepMeta.id)) {
        window.setTimeout(() => {
          scrollTourTargetIntoViewCenter(element);
        }, stepMeta.id === 'inv-matrix' || stepMeta.id === 'inv-reorder' ? 260 : 80);
      } else if (stepMeta?.id === 'module-nav') {
        window.setTimeout(() => scheduleReposition(programStep), 320);
      }
      const wrapper = document.querySelector<HTMLElement>('.gates-tour-popover.driver-popover');
      if (wrapper) wrapper.dataset.gatesTourStep = String(programStep);
      if (activeDriver) bindCheckpointListeners(programStep, activeDriver);
      if (activeDriver) bindTriggerListener(programStep, activeDriver);
      if (activeDriver) bindKeyboard(activeDriver);
      window.setTimeout(
        () => scheduleReposition(programStep),
        stepMeta?.id === 'inv-matrix' || stepMeta?.id === 'inv-reorder' ? 280 : 100
      );
    },
    onDeselected: () => {
      /* keep spotlight stable — cleared on tour destroy only */
    },
    onDestroyStarted: () => {
      clearCheckpointListeners();
      clearTriggerListener();
      getAcademyStoreState().setWaitingForTrigger(null);
      keyboardCleanup?.();
      keyboardCleanup = null;
      repositionCleanup?.();
      repositionCleanup = null;
      window.dispatchEvent(new CustomEvent(GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT));
      clearTourBodyClass();
      forceDriverDomCleanup();
      document.querySelectorAll('.gates-tour-spotlight').forEach((el) => {
        el.classList.remove('gates-tour-spotlight', 'gates-academy-awaiting-trigger');
      });
      options.onDestroyStarted?.();
    },
  });

  activeDriver = drv;
  return drv;
}

export function resolveRouteScopedDriveIndex(
  program: AcademyProgram,
  pathname: string | null,
  programStepIndex: number
): number {
  const { programStepIndices } = buildRouteScopedSteps(program, pathname);
  const local = programStepIndices.indexOf(programStepIndex);
  return local >= 0 ? local : 0;
}

export async function createProductTourDriver(options: CreateProductTourDriverOptions = {}): Promise<Driver> {
  const program = getAcademyProgram('foundation-8');
  let step = 0;
  return createAcademyDriver({
    program,
    pathname: '/dashboard',
    startProgramStepIndex: 0,
    getProgramStepIndex: () => step,
    setProgramStepIndex: (i) => {
      step = i;
    },
    onDestroyStarted: options.onDestroyStarted,
  });
}
