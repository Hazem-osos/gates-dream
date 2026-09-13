/** Destroys the active driver instance entirely (Escape key, skip, sandbox quick-exit). */
export const GATES_TOUR_INTERRUPT_EVENT = 'gates:tour-interrupt';

export const GATES_ACADEMY_CHECKPOINT_EVENT = 'gates:academy-checkpoint';
export const GATES_ACADEMY_EXPAND_SIDEBAR_EVENT = 'gates:academy-expand-sidebar';
/** Opens the navbar module grid (AppTabs row) — primary module navigation in the app. */
export const GATES_ACADEMY_OPEN_MODULE_MENU_EVENT = 'gates:academy-open-module-menu';
/** Closes the module grid row so document steps (e.g. sales invoice) align correctly. */
export const GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT = 'gates:academy-close-module-menu';
/** Collapse the right navigation drawer after in-hub navigation. */
export const GATES_NAV_SIDEBAR_COLLAPSE_EVENT = 'gates:nav-sidebar-collapse';
/** Page-specific prep before highlighting (e.g. switch item-card tab). */
export const GATES_ACADEMY_PREPARE_STEP_EVENT = 'gates:academy-prepare-step';

export type AcademyPrepareStepDetail = {
  stepId: string;
};

export function dispatchAcademyPrepareStep(stepId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AcademyPrepareStepDetail>(GATES_ACADEMY_PREPARE_STEP_EVENT, {
      detail: { stepId },
    })
  );
}

export type AcademyCheckpointType = 'cmd-k-open' | 'privacy-toggle';

export type AcademyCheckpointDetail = {
  type: AcademyCheckpointType;
};

export function dispatchAcademyCheckpoint(type: AcademyCheckpointType) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AcademyCheckpointDetail>(GATES_ACADEMY_CHECKPOINT_EVENT, {
      detail: { type },
    })
  );
}

export function dispatchExpandModuleSidebar() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GATES_ACADEMY_EXPAND_SIDEBAR_EVENT));
}

export function dispatchOpenModuleMenu() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GATES_ACADEMY_OPEN_MODULE_MENU_EVENT));
}

export function dispatchCloseModuleMenu() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT));
}

export function dispatchCollapseNavSidebar() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GATES_NAV_SIDEBAR_COLLAPSE_EVENT));
}

/**
 * Generic trigger registry (additive) — extends the two hardcoded checkpoint
 * types above into a reusable taxonomy for newly authored tours. The legacy
 * `AcademyCheckpointType`/`dispatchAcademyCheckpoint` above are untouched and
 * keep working exactly as before for the foundation-8 program.
 */
export type AcademyTriggerKind = 'CLICK' | 'INPUT_CHANGE' | 'SELECT_OPTION' | 'API_SUCCESS' | 'CUSTOM';

export const GATES_ACADEMY_TRIGGER_EVENT = 'gates:academy-trigger';

export type AcademyTriggerDetail = {
  kind: AcademyTriggerKind;
  /** Namespaced id, e.g. "sales-invoice.save-click". */
  id: string;
  value?: string;
};

/**
 * Dispatch a generic step trigger. `CLICK`/`INPUT_CHANGE`/`SELECT_OPTION` are
 * normally dispatched automatically by the delegated DOM listener in
 * `ProductTourProvider` (via `data-academy-trigger-id` attributes) — screens
 * don't need to call this themselves for those three kinds. `API_SUCCESS` is
 * dispatched manually from a mutation's `onSuccess`, same pattern as the
 * existing `dispatchAcademyCheckpoint` call sites.
 */
export function dispatchAcademyTrigger(kind: AcademyTriggerKind, id: string, value?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AcademyTriggerDetail>(GATES_ACADEMY_TRIGGER_EVENT, {
      detail: { kind, id, value },
    })
  );
}

/** Attribute read by the delegated listener; kind is inferred from the DOM event type. */
export const ACADEMY_TRIGGER_ID_ATTR = 'data-academy-trigger-id';
