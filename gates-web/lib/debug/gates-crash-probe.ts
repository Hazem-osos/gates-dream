/**
 * Development-only crash probe. No-ops in production.
 * Logs stacks and counts navigation/draft flush so a RangeError can be
 * attributed to a repeating call, not guessed.
 */

export const GATES_CRASH_PROBE = process.env.NODE_ENV === 'development';

export type GatesProbeName =
  | 'router.push'
  | 'router.replace'
  | 'openAppTab'
  | 'openFreshPage'
  | 'destinationAppTabHref'
  | 'flushPageDrafts'
  | 'persistNow'
  | 'tab state updates';

declare global {
  interface Window {
    __gatesCrashProbe?: boolean;
    __gatesProbeCounts?: Record<string, number>;
  }
}

function counts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  if (!window.__gatesProbeCounts) window.__gatesProbeCounts = {};
  return window.__gatesProbeCounts;
}

export function probeCount(name: GatesProbeName, extra?: Record<string, unknown>) {
  if (!GATES_CRASH_PROBE || typeof window === 'undefined') return;
  const bag = counts();
  bag[name] = (bag[name] ?? 0) + 1;
  console.count(`GATES_PROBE ${name}`);
  if (bag[name] <= 8 || bag[name] % 25 === 0) {
    console.trace(`GATES_PROBE_TRACE ${name}`, extra ?? '');
  }
  if (bag[name] === 20 || bag[name] === 100 || bag[name] === 250) {
    console.warn('GATES_PROBE_COUNTS', { ...bag });
  }
}

export function probeNavUrl(current: string, target: string) {
  if (!GATES_CRASH_PROBE || typeof window === 'undefined') return;
  console.log('GATES_PROBE_URL', {
    CURRENT: current,
    TARGET: target,
    TARGET_LENGTH: target.length,
  });
}

export function captureFatalError(error: unknown, componentStack?: string | null) {
  console.error('GATES_FATAL_ERROR', error);
  const err = error as { stack?: string };
  console.error('STACK', err?.stack);
  if (componentStack) console.error('COMPONENT_STACK', componentStack);
  if (typeof window !== 'undefined') {
    console.error('GATES_PROBE_COUNTS_AT_FATAL', { ...(window.__gatesProbeCounts ?? {}) });
  }
}

export function installCrashProbe() {
  if (!GATES_CRASH_PROBE || typeof window === 'undefined') return;
  if (window.__gatesCrashProbe) return;
  window.__gatesCrashProbe = true;
  window.addEventListener('error', (event) => {
    captureFatalError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureFatalError(event.reason);
  });
}
