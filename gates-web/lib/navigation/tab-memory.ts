import { normalizeAppPath } from '@/lib/navigation/app-module-root';

const HREF_KEY = 'gates:tab-hrefs';
const SEARCH_KEY = 'gates:tab-search';
const TABS_KEY = 'gates:open-tabs';

type HrefMap = Record<string, string>;

function readMap(key: string): HrefMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HrefMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: HrefMap) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function splitTabHref(input: string): { path: string; href: string } {
  const hashless = input.split('#')[0] ?? input;
  const q = hashless.indexOf('?');
  const rawPath = q === -1 ? hashless : hashless.slice(0, q);
  const search = q === -1 ? '' : hashless.slice(q + 1);
  const path = normalizeAppPath(rawPath);
  return { path, href: search ? `${path}?${search}` : path };
}

export function rememberTabHref(path: string, href: string) {
  const normalized = normalizeAppPath(path);
  if (!normalized) return;
  const map = readMap(HREF_KEY);
  map[normalized] = href;
  writeMap(HREF_KEY, map);
}

export function recalledTabHref(path: string): string | null {
  const normalized = normalizeAppPath(path);
  return readMap(HREF_KEY)[normalized] || null;
}

export function rememberTabSearch(path: string, search: string) {
  const normalized = normalizeAppPath(path);
  if (!normalized) return;
  const map = readMap(SEARCH_KEY);
  map[normalized] = search;
  writeMap(SEARCH_KEY, map);
}

export function recalledTabSearch(path: string): string {
  const normalized = normalizeAppPath(path);
  return readMap(SEARCH_KEY)[normalized] || '';
}

export function pinCurrentWindowHref() {
  if (typeof window === 'undefined') return;
  const path = normalizeAppPath(window.location.pathname);
  const search = window.location.search.replace(/^\?/, '');
  const href = search ? `${path}?${search}` : path;
  rememberTabHref(path, href);
  rememberTabSearch(path, search);
}

/** Bare paths restore the last open document; explicit `?id=` / query wins. */
export function resolveAppTabHref(href: string): string {
  const { path, href: normalized } = splitTabHref(href);
  if (normalized !== path) return normalized;
  return recalledTabHref(path) ?? normalized;
}

/** Pin the page you are leaving, then resolve the destination so an open document is not lost. */
export function destinationAppTabHref(href: string): string {
  pinCurrentWindowHref();
  return resolveAppTabHref(href);
}

export type PersistedAppTab = {
  path: string;
  href: string;
  label: string;
};

export function persistOpenTabs(tabs: PersistedAppTab[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {
    /* ignore */
  }
}

export function loadOpenTabs(): PersistedAppTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedAppTab[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (tab) => tab && typeof tab.path === 'string' && typeof tab.href === 'string'
    );
  } catch {
    return [];
  }
}
