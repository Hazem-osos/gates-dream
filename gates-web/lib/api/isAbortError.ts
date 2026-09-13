/**
 * Central cancellation detection for fetch, axios-style codes, and TanStack Query.
 * Intentional aborts must never reach error boundaries or global toasts.
 */

import { isCancelledError } from '@tanstack/query-core';

const ABORT_HINTS = [
  'abort',
  'aborted a request',
  'signal is aborted',
  'without reason',
  'cancelled',
  'canceled',
  'cancellederror',
  'err_canceled',
];

function messageLooksAborted(message: string): boolean {
  const msg = message.toLowerCase();
  return ABORT_HINTS.some((hint) => msg.includes(hint));
}

function abortLikeFromUnknown(value: unknown): boolean {
  if (value == null) return false;

  if (value instanceof AggregateError) {
    return value.errors.some((e) => abortLikeFromUnknown(e));
  }

  if (value instanceof DOMException) {
    if (value.name === 'AbortError' || value.name === 'TimeoutError') return true;
    if (messageLooksAborted(value.message)) return true;
  }

  if (typeof value === 'object' && value !== null) {
    const rec = value as Record<string, unknown>;
    if (rec.name === 'AbortError' || rec.name === 'TimeoutError' || rec.name === 'CancelledError') {
      return true;
    }
    if (rec.code === 'ERR_CANCELED' || rec.code === 'ECONNABORTED') return true;
    if (typeof rec.message === 'string' && messageLooksAborted(rec.message)) return true;
  }

  if (value instanceof Error) {
    if (value.name === 'AbortError' || value.name === 'TimeoutError') return true;
    if (value.name === 'CancelledError') return true;
    if (messageLooksAborted(value.message)) return true;
    const code = (value as Error & { code?: string }).code;
    if (code === 'ERR_CANCELED' || code === 'ECONNABORTED') return true;
  }

  if (typeof value === 'string' && messageLooksAborted(value)) return true;

  return false;
}

/** Walk error.cause / AggregateError — matches DOMException "signal is aborted without reason". */
export function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.message === 'signal is aborted without reason') {
    return true;
  }
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (abortLikeFromUnknown(current)) return true;
    if (isCancelledError(current)) return true;
    if (typeof current === 'object' && 'cause' in current) {
      current = (current as { cause?: unknown }).cause;
    } else if (typeof current === 'object' && 'reason' in current) {
      current = (current as { reason?: unknown }).reason;
    } else {
      break;
    }
  }
  return false;
}

/** @deprecated Prefer `isAbortError` — kept for existing imports. */
export const isAbortLikeError = isAbortError;

/** Normalize to a standard AbortError (safe to throw inside queryFn; converted to CancelledError upstream). */
export function asAbortError(error: unknown): DOMException {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return error;
  }
  return new DOMException('The operation was aborted.', 'AbortError');
}

/** HTTP 429 — do not retry or throw into Next.js error overlay. */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const api = error as Error & { code?: string; status?: string };
  if (api.code === '429') return true;
  const msg = error.message.toLowerCase();
  return msg.includes('too many requests') || msg.includes('rate limit');
}

/** HTTP 304 — client should keep the last successful payload. */
export function isNotModifiedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const api = error as Error & { code?: string };
  if (api.code === '304') return true;
  const msg = error.message.toLowerCase();
  return msg.includes('304') && msg.includes('not modified');
}

/** Query/mutation failures that should be silent (no toast, no boundary, no retry). */
export function isSoftQueryFailure(error: unknown): boolean {
  return (
    isAbortError(error) ||
    isRateLimitError(error) ||
    isCancelledError(error) ||
    isNotModifiedError(error)
  );
}

/** Brief window after academy tour route changes — Next.js RSC fetches abort loudly in dev. */
let abortNoiseGraceUntil = 0;

export function markAbortNoiseGracePeriod(ms = 3000): void {
  abortNoiseGraceUntil = Date.now() + ms;
}

function inAbortNoiseGracePeriod(): boolean {
  return typeof window !== 'undefined' && Date.now() < abortNoiseGraceUntil;
}

/** Used by global handlers during tour navigation (dev overlay suppression). */
export function shouldSuppressAbortNoise(reason: unknown): boolean {
  if (isAbortError(reason)) return true;
  if (!inAbortNoiseGracePeriod() || reason == null) return false;
  if (reason instanceof DOMException) return true;
  if (typeof reason === 'string') return messageLooksAborted(reason);
  if (reason instanceof Error) return messageLooksAborted(reason.message);
  if (typeof reason === 'object' && 'message' in reason) {
    const msg = (reason as { message?: unknown }).message;
    return typeof msg === 'string' && messageLooksAborted(msg);
  }
  return false;
}
