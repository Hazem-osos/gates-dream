import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import { probeCount, probeNavUrl } from '@/lib/debug/gates-crash-probe';

const HREF_KEY = 'gates:tab-hrefs';
const SEARCH_KEY = 'gates:tab-search';
const TABS_KEY = 'gates:open-tabs';

/** Legacy routes that shared one screen — collapse to a single tab path. */
const TAB_PATH_ALIASES: Record<string, string> = {
  '/accounting/journal-entries': '/accounting/operations/journal-entry',
  '/accounting/journal-entries/new': '/accounting/operations/journal-entry',
};

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

/** Explicit `?id=` / query wins. Bare paths stay new — do not restore the last document. */
export function resolveAppTabHref(href: string): string {
  const { href: normalized } = splitTabHref(href);
  return normalized;
}

export function migrateTabPath(path: string): string {
  const normalized = normalizeAppPath(path);
  return TAB_PATH_ALIASES[normalized] ?? normalized;
}

export function migrateTabHref(href: string): string {
  const { path, href: full } = splitTabHref(href);
  const migrated = migrateTabPath(path);
  if (migrated === path) return full;
  const q = full.indexOf('?');
  const search = q === -1 ? '' : full.slice(q);
  return search ? `${migrated}${search}` : migrated;
}

/** One tab per normalized path; merge legacy aliases and prefer hrefs that carry `?` state. */
export function dedupePersistedTabs(tabs: PersistedAppTab[]): PersistedAppTab[] {
  const byPath = new Map<string, PersistedAppTab>();
  for (const raw of tabs) {
    const href = migrateTabHref(raw.href || raw.path);
    const path = migrateTabPath(splitTabHref(href).path);
    const candidate: PersistedAppTab = {
      path,
      href,
      label: raw.label,
    };
    const prev = byPath.get(path);
    if (!prev) {
      byPath.set(path, candidate);
      continue;
    }
    const prevHasQuery = prev.href.includes('?');
    const nextHasQuery = candidate.href.includes('?');
    if (!prevHasQuery && nextHasQuery) byPath.set(path, candidate);
  }
  return [...byPath.values()];
}

export function currentAppTabHref(): string {
  if (typeof window === 'undefined') return '';
  const path = normalizeAppPath(window.location.pathname);
  const search = window.location.search.replace(/^\?/, '');
  return search ? `${path}?${search}` : path;
}

/** Pin the page you are leaving, then go to the destination as given. */
export function destinationAppTabHref(href: string): string {
  probeCount('destinationAppTabHref', { href });
  if (typeof window !== 'undefined') {
    probeNavUrl(`${window.location.pathname}${window.location.search}`, href);
  }
  flushPageDrafts();
  pinCurrentWindowHref();
  return resolveAppTabHref(href);
}

export function rememberFreshPage(path: string) {
  const normalized = normalizeAppPath(path);
  if (!normalized) return;
  rememberTabHref(normalized, normalized);
  rememberTabSearch(normalized, '');
}

export type PersistedAppTab = {
  path: string;
  href: string;
  label: string;
};

export function persistOpenTabs(tabs: PersistedAppTab[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TABS_KEY, JSON.stringify(dedupePersistedTabs(tabs)));
  } catch {
    /* ignore */
  }
}

/** Drop tab bar state on logout so the next session starts clean. */
export function clearTabSessionStorage() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TABS_KEY);
    sessionStorage.removeItem(HREF_KEY);
    sessionStorage.removeItem(SEARCH_KEY);
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
    const filtered = parsed.filter(
      (tab) => tab && typeof tab.path === 'string' && typeof tab.href === 'string'
    );
    return dedupePersistedTabs(filtered);
  } catch {
    return [];
  }
}
