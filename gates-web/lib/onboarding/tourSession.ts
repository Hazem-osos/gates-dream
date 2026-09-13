'use client';

export const FOUNDATION_TOUR_FINISHED_SESSION_KEY = 'gates:foundation-tour-finished';

export const GATES_FOUNDATION_TOUR_DONE_EVENT = 'gates:foundation-tour-done';

export function isFoundationTourFinishedSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(FOUNDATION_TOUR_FINISHED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setFoundationTourFinishedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FOUNDATION_TOUR_FINISHED_SESSION_KEY, '1');
    window.dispatchEvent(new CustomEvent(GATES_FOUNDATION_TOUR_DONE_EVENT));
  } catch {
    /* ignore */
  }
}

export function clearFoundationTourFinishedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FOUNDATION_TOUR_FINISHED_SESSION_KEY);
    window.dispatchEvent(new CustomEvent(GATES_FOUNDATION_TOUR_DONE_EVENT));
  } catch {
    /* ignore */
  }
}

/** After finishing a program, block stale ?academyTour= from relaunching until user clicks start again. */
const URL_SUPPRESS_PREFIX = 'gates:academy-url-suppress:';

export function setAcademyTourUrlSuppressSession(programId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${URL_SUPPRESS_PREFIX}${programId}`, '1');
  } catch {
    /* ignore */
  }
}

export function clearAcademyTourUrlSuppressSession(programId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`${URL_SUPPRESS_PREFIX}${programId}`);
  } catch {
    /* ignore */
  }
}

export function shouldSuppressAcademyTourUrl(programId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(`${URL_SUPPRESS_PREFIX}${programId}`) === '1';
  } catch {
    return false;
  }
}
