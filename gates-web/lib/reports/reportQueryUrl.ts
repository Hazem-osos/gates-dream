import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { rememberTabHref, rememberTabSearch } from '@/lib/navigation/tab-memory';

/** Keeps the current report filters in the address bar and the open tab. */
export function writeReportSearch(params: Record<string, string> | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.search = '';
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== '') url.searchParams.set(key, value);
    }
  }
  const path = normalizeAppPath(url.pathname);
  const search = url.search.replace(/^\?/, '');
  rememberTabSearch(path, search);
  rememberTabHref(path, search ? `${path}?${search}` : path);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}
