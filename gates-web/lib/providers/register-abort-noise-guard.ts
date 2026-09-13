/**
 * Register before React hydrates so navigation/query aborts never open the dev overlay.
 * Safe to call multiple times (idempotent).
 */
import { isAbortError, shouldSuppressAbortNoise } from '@/lib/api/isAbortError';

declare global {
  interface Window {
    __gatesAbortNoiseGuard?: boolean;
  }
}

function swallowAbortLike(reason: unknown): boolean {
  if (shouldSuppressAbortNoise(reason)) return true;
  if (isAbortError(reason)) return true;
  if (reason == null) return false;
  try {
    const text = String(reason);
    if (text.toLowerCase().includes('abort')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
  if (swallowAbortLike(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function onWindowError(event: ErrorEvent) {
  if (swallowAbortLike(event.error ?? event.message)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

export function registerAbortNoiseGuard(): void {
  if (typeof window === 'undefined') return;
  if (window.__gatesAbortNoiseGuard) return;
  window.__gatesAbortNoiseGuard = true;

  window.addEventListener('unhandledrejection', onUnhandledRejection, true);
  window.addEventListener('error', onWindowError, true);
}

if (typeof window !== 'undefined') {
  registerAbortNoiseGuard();
}
