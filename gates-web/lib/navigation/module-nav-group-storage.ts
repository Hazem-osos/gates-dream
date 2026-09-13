const PREFIX = 'gates:module-nav-groups:';

export type NavGroupOpenState = Record<string, boolean>;

export function readNavGroupOpenState(moduleKey: string): NavGroupOpenState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${PREFIX}${moduleKey}`);
    if (!raw) return {};
    return JSON.parse(raw) as NavGroupOpenState;
  } catch {
    return {};
  }
}

export function writeNavGroupOpenState(moduleKey: string, state: NavGroupOpenState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${PREFIX}${moduleKey}`, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
