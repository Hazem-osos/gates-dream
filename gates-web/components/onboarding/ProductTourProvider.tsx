'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import '@/components/onboarding/product-tour.css';
import type { Driver } from 'driver.js';
import { apiClient } from '@/lib/api/client';
import { createAcademyDriver, resolveRouteScopedDriveIndex } from '@/components/onboarding/useProductTour';
import type { OnboardingStatus } from '@/lib/hooks/useOnboardingStatus';
import type { ApiResponse } from '@/lib/api/types';
import {
  onboardingStatusQueryKey,
  persistOnboardingStatus,
} from '@/lib/onboarding/onboarding-status-cache';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import {
  ACADEMY_RESUME_STORAGE_KEY,
  getAcademyProgram,
  pathnameMatchesRoute,
  type AcademyProgramId,
} from '@/lib/onboarding/academyTours';
import { markAcademyProgramComplete } from '@/lib/onboarding/academyProgress';
import { pushTourRoute, replaceTourRoute } from '@/lib/onboarding/tourNavigation';
import { markAbortNoiseGracePeriod } from '@/lib/api/isAbortError';
import {
  clearFoundationTourFinishedSession,
  clearAcademyTourUrlSuppressSession,
  isFoundationTourFinishedSession,
  setAcademyTourUrlSuppressSession,
  setFoundationTourFinishedSession,
  shouldSuppressAcademyTourUrl,
} from '@/lib/onboarding/tourSession';
import { forceDriverDomCleanup } from '@/components/onboarding/TourPopover';
import { resolveTourStepIndex, waitForSelectorResilient, isSlowLoadingStepId } from '@/lib/onboarding/tourEngine';

import {
  GATES_ACADEMY_OPEN_MODULE_MENU_EVENT,
  GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT,
  ACADEMY_TRIGGER_ID_ATTR,
  dispatchAcademyTrigger,
  GATES_TOUR_INTERRUPT_EVENT,
  type AcademyTriggerKind,
} from '@/lib/onboarding/tourCheckpoints';
import { getAcademyStoreState } from '@/lib/onboarding/academyStore';
import { useAcademyProgressSync } from '@/lib/hooks/useAcademyProgressSync';
import { AcademyRouteTransitionOverlay } from '@/components/onboarding/AcademyRouteTransitionOverlay';
import { AcademySandboxBanner } from '@/components/onboarding/AcademySandboxBanner';
import { AcademyResumePill } from '@/components/onboarding/AcademyResumePill';

export { GATES_TOUR_INTERRUPT_EVENT };

export const PRODUCT_TOUR_DASHBOARD_PATH = '/dashboard';

const TOUR_QUERY_PARAM_KEYS = ['startTour', 'tour', 'academyTour', 'tourNonce'] as const;

function stripTourQueryFromBrowserHistory(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of TOUR_QUERY_PARAM_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return changed;
}

function hasTourQueryInSearchParams(searchParams: URLSearchParams): boolean {
  if (searchParams.get('academyTour')) return true;
  if (searchParams.get('tourNonce')) return true;
  if (searchParams.get('startTour') === 'true') return true;
  if (searchParams.get('tour') === '1') return true;
  return false;
}

export function isProductTourDashboard(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/$/, '') || '/';
  return normalized === PRODUCT_TOUR_DASHBOARD_PATH || normalized === '/';
}

type ResumePayload = {
  programId: AcademyProgramId;
  stepIndex: number;
};

type ProductTourContextValue = {
  startTour: () => void;
  startAcademyProgram: (programId: AcademyProgramId) => void;
  openAcademy: () => void;
  closeAcademy: () => void;
  academyOpen: boolean;
  pauseTour: () => void;
  resumeTour: () => void;
};

const ProductTourContext = createContext<ProductTourContextValue>({
  startTour: () => {},
  startAcademyProgram: () => {},
  openAcademy: () => {},
  closeAcademy: () => {},
  academyOpen: false,
  pauseTour: () => {},
  resumeTour: () => {},
});

const SANDBOX_TRAINING_PREFIX = '[تدريب] ';

/**
 * Additive sandbox safety net (item 5 of the plan): for sandbox-flagged
 * tours, free-text description/serial fields marked with
 * `data-academy-trigger-id` get auto-prefixed with "[تدريب]" so any real
 * record created while training stays discoverable/cleanable afterward.
 * Uses the native-setter + dispatched `input` event trick so React-controlled
 * inputs pick up the change. Known limitation: this labels data heuristically
 * (free-text fields only) rather than provisioning a true ephemeral sandbox
 * tenant, which is out of scope for this pass.
 */
function applySandboxInputPrefix(
  el: HTMLElement | null,
  kind: AcademyTriggerKind
): string | undefined {
  const current = (el as HTMLInputElement | HTMLTextAreaElement | null)?.value;
  if (!getAcademyStoreState().sandboxActive) return current;
  if (kind !== 'INPUT_CHANGE') return current;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return current;
  if (el instanceof HTMLInputElement && el.type !== 'text' && el.type !== 'search') return current;
  const value = el.value;
  if (!value || value.startsWith(SANDBOX_TRAINING_PREFIX)) return value;

  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  const nextValue = `${SANDBOX_TRAINING_PREFIX}${value}`;
  nativeSetter?.call(el, nextValue);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return nextValue;
}

/** @deprecated foundation tour only — rich tours use resolveTourStepIndex */

async function persistTourCompleteOnServer() {
  try {
    await apiClient.post('/onboarding/complete-tour');
  } catch {
    /* ignore — session + cache stay complete */
  }
}

function clearTourQueryParams(router: ReturnType<typeof useRouter>, pathname: string) {
  if (typeof window === 'undefined') return;
  markAbortNoiseGracePeriod(1500);
  stripTourQueryFromBrowserHistory();
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of TOUR_QUERY_PARAM_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    router.replace(pathname + (url.search ? url.search : ''));
  }
}

function academyTourQuery(programId: AcademyProgramId, tourNonce?: string | null) {
  const q = new URLSearchParams({ academyTour: programId });
  if (tourNonce) q.set('tourNonce', tourNonce);
  return q;
}

function readResume(): ResumePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACADEMY_RESUME_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResumePayload;
  } catch {
    return null;
  }
}

function writeResume(payload: ResumePayload | null) {
  if (typeof window === 'undefined') return;
  if (!payload) sessionStorage.removeItem(ACADEMY_RESUME_STORAGE_KEY);
  else sessionStorage.setItem(ACADEMY_RESUME_STORAGE_KEY, JSON.stringify(payload));
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const driverRef = useRef<Driver | null>(null);
  const tourLaunchLock = useRef(false);
  const markCompleteOnDestroy = useRef(true);
  const markOnboardingApiRef = useRef(false);
  const navigatingBetweenSteps = useRef(false);
  const activeProgramId = useRef<AcademyProgramId | null>(null);
  const checkpointSatisfied = useRef<Record<number, boolean>>({});
  const tourEffectGeneration = useRef(0);
  const tourFinishedSuccessfullyRef = useRef(false);
  const tourCompleteHandledRef = useRef(false);
  const explicitTourStartRef = useRef(false);
  const academyTourRelaunchPendingRef = useRef(false);
  const activeProgramStepRef = useRef(0);
  const isPausedRef = useRef(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const [routeTransitioning, setRouteTransitioningState] = useState(false);
  const routeTransitionSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Safety net: never let the transition overlay get stuck visible past ~20s. */
  const setRouteTransitioning = useCallback((value: boolean) => {
    setRouteTransitioningState(value);
    if (routeTransitionSafetyTimer.current) {
      clearTimeout(routeTransitionSafetyTimer.current);
      routeTransitionSafetyTimer.current = null;
    }
    if (value) {
      routeTransitionSafetyTimer.current = setTimeout(() => {
        setRouteTransitioningState(false);
      }, 20000);
    }
  }, []);

  useAcademyProgressSync();

  /** Delegated listener for `data-academy-trigger-id` — additive to the driver.js lifecycle above. */
  useEffect(() => {
    const findTriggerEl = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>(`[${ACADEMY_TRIGGER_ID_ATTR}]`);
    };

    const onClick = (e: MouseEvent) => {
      const el = findTriggerEl(e.target);
      const id = el?.getAttribute(ACADEMY_TRIGGER_ID_ATTR);
      if (!id) return;
      dispatchAcademyTrigger('CLICK', id);
    };

    const onChange = (e: Event) => {
      const el = findTriggerEl(e.target);
      const id = el?.getAttribute(ACADEMY_TRIGGER_ID_ATTR);
      if (!id) return;
      const kind: AcademyTriggerKind = el?.tagName === 'SELECT' ? 'SELECT_OPTION' : 'INPUT_CHANGE';
      const value = applySandboxInputPrefix(el, kind);
      dispatchAcademyTrigger(kind, id, value);
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
    };
  }, []);

  const finishTour = useCallback(async () => {
    const companyId = getTenantContext().companyId;
    const applyComplete = (old: ApiResponse<OnboardingStatus> | undefined) => {
      if (!old?.data) return old;
      const data = { ...old.data, hasCompletedTour: true };
      if (companyId) persistOnboardingStatus(companyId, data);
      return { ...old, data };
    };
    queryClient.setQueryData<ApiResponse<OnboardingStatus>>(
      [...onboardingStatusQueryKey, undefined],
      applyComplete
    );
    await persistTourCompleteOnServer();
    queryClient.setQueryData<ApiResponse<OnboardingStatus>>(
      [...onboardingStatusQueryKey, undefined],
      applyComplete
    );
    driverRef.current = null;
    tourLaunchLock.current = false;
  }, [queryClient]);

  const finalizeAcademyTourComplete = useCallback(
    (programId: AcademyProgramId) => {
      if (tourCompleteHandledRef.current) return;
      tourCompleteHandledRef.current = true;
      tourFinishedSuccessfullyRef.current = true;
      setAcademyTourUrlSuppressSession(programId);
      markAcademyProgramComplete(programId);
      writeResume(null);
      stripTourQueryFromBrowserHistory();
      if (programId === 'foundation-8') {
        setFoundationTourFinishedSession();
        void finishTour();
      }
    },
    [finishTour]
  );

  const runAcademyAtStep = useCallback(
    async (programId: AcademyProgramId, stepIndex: number, effectGeneration: number) => {
      if (driverRef.current?.isActive()) return;

      const program = getAcademyProgram(programId);
      const resolved = await resolveTourStepIndex(program, stepIndex, pathname);
      if (effectGeneration !== tourEffectGeneration.current) return;

      if (resolved.kind === 'navigate') {
        writeResume({ programId, stepIndex: resolved.stepIndex });
        const q = academyTourQuery(programId, searchParams.get('tourNonce'));
        const href = `${resolved.route}?${q.toString()}`;
        setRouteTransitioning(true);
        router.prefetch(resolved.route);
        void pushTourRoute(router, queryClient, href);
        return;
      }

      if (resolved.kind === 'complete') {
        finalizeAcademyTourComplete(programId);
        stripTourQueryFromBrowserHistory();
        clearTourQueryParams(router, pathname ?? PRODUCT_TOUR_DASHBOARD_PATH);
        return;
      }

      const effectiveStepIndex = resolved.stepIndex;
      const meta = program.meta[effectiveStepIndex];
      const stepEl = program.steps[effectiveStepIndex]?.element;
      const selector = typeof stepEl === 'string' ? stepEl : '[data-tour="global-search"]';

      if (meta && !pathnameMatchesRoute(pathname, meta.route)) {
        writeResume({ programId, stepIndex: effectiveStepIndex });
        const q = academyTourQuery(programId, searchParams.get('tourNonce'));
        const href = `${meta.route}?${q.toString()}`;
        setRouteTransitioning(true);
        router.prefetch(meta.route);
        void pushTourRoute(router, queryClient, href);
        return;
      }

      markCompleteOnDestroy.current = true;
      markOnboardingApiRef.current = programId === 'foundation-8';
      activeProgramId.current = programId;
      activeProgramStepRef.current = effectiveStepIndex;

      {
        const store = getAcademyStoreState();
        if (store.status === 'PAUSED' && store.activeProgramId === programId) {
          store.resume();
        } else if (store.activeProgramId !== programId || store.status === 'IDLE' || store.status === 'COMPLETED') {
          store.start(programId, program.meta.length, program.sandboxRecommended);
        }
        store.setStep(effectiveStepIndex, program.meta.length);
      }

      if (meta?.id === 'module-nav') {
        window.dispatchEvent(new CustomEvent(GATES_ACADEMY_OPEN_MODULE_MENU_EVENT));
      } else {
        window.dispatchEvent(new CustomEvent(GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT));
      }

      const waitMs = isSlowLoadingStepId(meta?.id) ? 15000 : 8000;
      await waitForSelectorResilient(selector, waitMs);
      setRouteTransitioning(false);
      if (effectGeneration !== tourEffectGeneration.current) return;
      if (driverRef.current?.isActive()) return;

      const drv = await createAcademyDriver({
        program,
        pathname,
        startProgramStepIndex: effectiveStepIndex,
        getProgramStepIndex: () => activeProgramStepRef.current,
        setProgramStepIndex: (idx) => {
          activeProgramStepRef.current = idx;
        },
        getCheckpointSatisfied: (idx) => !!checkpointSatisfied.current[idx],
        setCheckpointSatisfied: (idx, val) => {
          checkpointSatisfied.current[idx] = val;
        },
        onActiveStep: (idx) => {
          writeResume({ programId, stepIndex: idx });
        },
        onRequestNavigate: (nextIndex, route) => {
          navigatingBetweenSteps.current = true;
          academyTourRelaunchPendingRef.current = true;
          markCompleteOnDestroy.current = false;
          tourFinishedSuccessfullyRef.current = false;
          tourLaunchLock.current = false;
          activeProgramStepRef.current = nextIndex;
          writeResume({ programId, stepIndex: nextIndex });
          const q = academyTourQuery(programId, searchParams.get('tourNonce'));
          setRouteTransitioning(true);
          router.prefetch(route);
          void pushTourRoute(router, queryClient, `${route}?${q.toString()}`);
        },
        onTourComplete: () => {
          const pid = activeProgramId.current;
          if (pid) finalizeAcademyTourComplete(pid);
        },
        onDestroyStarted: () => {
          if (isPausedRef.current) {
            isPausedRef.current = false;
            driverRef.current = null;
            tourLaunchLock.current = false;
            forceDriverDomCleanup();
            return;
          }

          if (navigatingBetweenSteps.current) {
            navigatingBetweenSteps.current = false;
            markCompleteOnDestroy.current = true;
            driverRef.current = null;
            tourLaunchLock.current = false;
            return;
          }

          const completed = tourFinishedSuccessfullyRef.current;
          if (!completed) {
            writeResume(null);
          }
          stripTourQueryFromBrowserHistory();
          tourLaunchLock.current = false;
          driverRef.current = null;
          forceDriverDomCleanup();

          if (completed && activeProgramId.current && !tourCompleteHandledRef.current) {
            finalizeAcademyTourComplete(activeProgramId.current);
          }

          if (!completed) {
            getAcademyStoreState().reset();
          }

          tourFinishedSuccessfullyRef.current = false;
          tourCompleteHandledRef.current = false;
          markCompleteOnDestroy.current = true;
          explicitTourStartRef.current = false;
          activeProgramId.current = null;
          checkpointSatisfied.current = {};
          clearTourQueryParams(router, pathname ?? PRODUCT_TOUR_DASHBOARD_PATH);
        },
      });

      driverRef.current = drv;
      const localDriveIndex = resolveRouteScopedDriveIndex(program, pathname, effectiveStepIndex);
      window.setTimeout(() => {
        if (effectGeneration !== tourEffectGeneration.current) return;
        if (driverRef.current !== drv) return;
        drv.drive(localDriveIndex);
        writeResume({ programId, stepIndex: effectiveStepIndex });
        academyTourRelaunchPendingRef.current = false;
      }, 350);
    },
    [finalizeAcademyTourComplete, pathname, queryClient, router, searchParams, setRouteTransitioning]
  );

  const startAcademyProgram = useCallback(
    (programId: AcademyProgramId) => {
      if (driverRef.current?.isActive()) {
        markCompleteOnDestroy.current = false;
        driverRef.current.destroy();
      }
      driverRef.current = null;
      setAcademyOpen(false);
      checkpointSatisfied.current = {};
      tourLaunchLock.current = false;
      tourFinishedSuccessfullyRef.current = false;
      tourCompleteHandledRef.current = false;
      clearFoundationTourFinishedSession();
      clearAcademyTourUrlSuppressSession(programId);
      explicitTourStartRef.current = true;
      tourEffectGeneration.current += 1;
      writeResume({ programId, stepIndex: 0 });
      const first = getAcademyProgram(programId).meta[0];
      const q = academyTourQuery(programId, String(Date.now()));
      void pushTourRoute(
        router,
        queryClient,
        `${first?.route ?? '/dashboard'}?${q.toString()}`
      );
    },
    [queryClient, router]
  );

  const startTour = useCallback(() => {
    startAcademyProgram('foundation-8');
  }, [startAcademyProgram]);

  const pauseTour = useCallback(() => {
    if (!driverRef.current?.isActive()) return;
    isPausedRef.current = true;
    markCompleteOnDestroy.current = false;
    tourFinishedSuccessfullyRef.current = false;
    getAcademyStoreState().pause();
    driverRef.current.destroy();
  }, []);

  const resumeTour = useCallback(() => {
    const store = getAcademyStoreState();
    const programId = store.activeProgramId;
    if (!programId || store.status !== 'PAUSED') return;
    const generation = ++tourEffectGeneration.current;
    void runAcademyAtStep(programId, store.activeStepIndex, generation);
  }, [runAcademyAtStep]);

  useEffect(() => {
    const onInterrupt = () => {
      if (!driverRef.current?.isActive()) return;
      markCompleteOnDestroy.current = false;
      driverRef.current.destroy();
    };
    window.addEventListener(GATES_TOUR_INTERRUPT_EVENT, onInterrupt);
    return () => window.removeEventListener(GATES_TOUR_INTERRUPT_EVENT, onInterrupt);
  }, []);

  /** Auto-pause (instead of losing progress) when the user switches tabs mid-tour. */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pauseTour();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pauseTour]);

  useEffect(() => {
    const pendingRelaunch = academyTourRelaunchPendingRef.current;
    if (driverRef.current?.isActive() && !pendingRelaunch) return;

    const resume = readResume();
    const paramTour = searchParams.get('academyTour') as AcademyProgramId | null;
    const legacyTour =
      searchParams.get('startTour') === 'true' || searchParams.get('tour') === '1';

    const programId = paramTour ?? (legacyTour ? 'foundation-8' : null);

    if (
      programId &&
      shouldSuppressAcademyTourUrl(programId) &&
      !explicitTourStartRef.current &&
      hasTourQueryInSearchParams(searchParams)
    ) {
      writeResume(null);
      stripTourQueryFromBrowserHistory();
      clearTourQueryParams(router, pathname ?? PRODUCT_TOUR_DASHBOARD_PATH);
      return;
    }

    if (
      programId === 'foundation-8' &&
      isFoundationTourFinishedSession() &&
      hasTourQueryInSearchParams(searchParams)
    ) {
      writeResume(null);
      stripTourQueryFromBrowserHistory();
      clearTourQueryParams(router, pathname ?? PRODUCT_TOUR_DASHBOARD_PATH);
      return;
    }

    if (!programId) {
      tourLaunchLock.current = false;
      return;
    }

    const stepIndex =
      resume?.programId === programId ? resume.stepIndex : 0;
    const meta = getAcademyProgram(programId).meta[stepIndex];
    if (meta && !pathnameMatchesRoute(pathname, meta.route)) {
      writeResume({ programId, stepIndex });
      const q = academyTourQuery(programId, searchParams.get('tourNonce'));
      void replaceTourRoute(router, queryClient, `${meta.route}?${q.toString()}`);
      return;
    }

    if (tourLaunchLock.current && !pendingRelaunch) return;
    tourLaunchLock.current = true;

    const generation = ++tourEffectGeneration.current;
    void (async () => {
      try {
        await runAcademyAtStep(programId, stepIndex, generation);
      } finally {
        if (!driverRef.current?.isActive()) {
          tourLaunchLock.current = false;
        }
      }
    })();

    return () => {
      if (!driverRef.current?.isActive()) {
        tourLaunchLock.current = false;
      }
    };
  }, [searchParams, pathname, queryClient, router, runAcademyAtStep]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
      tourLaunchLock.current = false;
      setRouteTransitioning(false);
    };
  }, [setRouteTransitioning]);

  const openAcademy = useCallback(() => {
    setAcademyOpen(false);
    router.push('/academy');
  }, [router]);
  const closeAcademy = useCallback(() => setAcademyOpen(false), []);

  return (
    <ProductTourContext.Provider
      value={{
        startTour,
        startAcademyProgram,
        openAcademy,
        closeAcademy,
        academyOpen,
        pauseTour,
        resumeTour,
      }}
    >
      {children}
      <AcademySandboxBanner />
      <AcademyResumePill onResume={resumeTour} />
      <AcademyRouteTransitionOverlay visible={routeTransitioning} />
    </ProductTourContext.Provider>
  );
}

export function useProductTourContext() {
  return useContext(ProductTourContext);
}

/** @deprecated Use ProductTourProvider; kept so existing layout imports keep working. */
export function ProductTour() {
  return null;
}
