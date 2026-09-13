import type { DriveStep } from 'driver.js';
import { resolveTourTarget, stepSelectorAtIndex } from '@/components/onboarding/tourPopoverPosition';
import { dispatchAcademyPrepareStep } from '@/lib/onboarding/tourCheckpoints';

export type TourProgramLike = {
  steps: DriveStep[];
  meta: Array<{ route: string; id?: string }>;
};

export function pathnameMatchesTourRoute(pathname: string | null, route: string): boolean {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, '') || '/';
  const r = route.replace(/\/$/, '') || '/';
  if (r === '/dashboard') return n === '/dashboard';
  return n === r || n.startsWith(`${r}/`);
}

export function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  return true;
}

/**
 * MutationObserver-primary, rAF-polling-fallback wait for a *visible* element.
 * Resolves the instant the DOM settles instead of always burning through a
 * fixed poll interval, so it can safely use a generous `maxMs` ceiling
 * without slowing down the common "already there" case.
 */
export function waitForSelectorResilient(selector: string, maxMs = 8000): Promise<Element | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    let done = false;
    let raf = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const check = (): Element | null => {
      const el = resolveTourTarget(selector);
      return el && isElementVisible(el) ? el : null;
    };

    const finish = (result: Element | null) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (timeoutId != null) clearTimeout(timeoutId);
      observer?.disconnect();
      resolve(result);
    };

    const immediate = check();
    if (immediate) {
      finish(immediate);
      return;
    }

    observer = new MutationObserver(() => {
      const el = check();
      if (el) finish(el);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const started = Date.now();
    const tick = () => {
      if (done) return;
      const el = check();
      if (el) {
        finish(el);
        return;
      }
      if (Date.now() - started >= maxMs) {
        finish(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    timeoutId = setTimeout(() => finish(check()), maxMs);
  });
}

/** @deprecated Use `waitForSelectorResilient` directly — kept for existing call sites. */
export async function waitForElement(
  selector: string,
  maxRetries = 15,
  intervalMs = 200
): Promise<Element | null> {
  return waitForSelectorResilient(selector, maxRetries * intervalMs);
}

/**
 * Steps whose target renders behind a data fetch (trees/grids/dashboards
 * that hydrate after the route lands) need much more than the ~3s default
 * before being auto-skipped as "missing". Auto-skipping too early is what
 * makes a tour look like it silently closes right after a page hop.
 */
const SLOW_LOADING_STEP_IDS = new Set([
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
  'sales-grid',
  'ext-boq',
  'sfi-grid',
  'gr-lines',
  'st-lines',
  'sk-table',
  'je-lines',
  'rv-lines',
  'pv-lines',
  'ch-tabs',
  'ch-inward',
]);

export function isSlowLoadingStepId(id: string | undefined): boolean {
  return !!id && SLOW_LOADING_STEP_IDS.has(id);
}

export function scrollTourTargetIntoViewCenter(element: Element | undefined) {
  if (!(element instanceof HTMLElement)) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

export type ResolveTourStepResult =
  | { kind: 'ready'; stepIndex: number }
  | { kind: 'navigate'; stepIndex: number; route: string }
  | { kind: 'complete'; lastAttemptedIndex: number };

/**
 * Find the first step at/after startIndex whose route matches and DOM target is visible.
 * Missing targets are skipped with a console info log (tour continues).
 */
export async function resolveTourStepIndex(
  program: TourProgramLike,
  startIndex: number,
  pathname: string | null
): Promise<ResolveTourStepResult> {
  const steps = program.steps;
  for (let i = startIndex; i < steps.length; i += 1) {
    const meta = program.meta[i];
    if (meta && !pathnameMatchesTourRoute(pathname, meta.route)) {
      return { kind: 'navigate', stepIndex: i, route: meta.route };
    }
    const selector = stepSelectorAtIndex(steps as DriveStep[], i);
    if (!selector) {
      console.info('[Gates Academy] skip step (no selector)', i);
      continue;
    }
    if (meta?.id) {
      dispatchAcademyPrepareStep(meta.id);
      const tabPrep =
        meta.id === 'inv-matrix' || meta.id === 'inv-reorder'
          ? 450
          : meta.id === 'inv-movements'
            ? 360
            : 240;
      await new Promise((r) => window.setTimeout(r, tabPrep));
    }
    const maxMs = meta?.id && SLOW_LOADING_STEP_IDS.has(meta.id) ? 15000 : 7000;
    const el = await waitForSelectorResilient(selector, maxMs);
    if (el) return { kind: 'ready', stepIndex: i };
    console.info('[Gates Academy] auto-skip missing/hidden target', i, selector);
  }
  return { kind: 'complete', lastAttemptedIndex: steps.length - 1 };
}
