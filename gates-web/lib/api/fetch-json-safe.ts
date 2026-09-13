import { isAbortError } from './isAbortError';

/**
 * Native fetch wrapper for one-off requests (health checks, etc.).
 * Returns `null` when the caller's signal aborted the request.
 */
export async function fetchJsonSafe<T>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (err) {
    if (isAbortError(err)) return null;
    throw err;
  }
}
