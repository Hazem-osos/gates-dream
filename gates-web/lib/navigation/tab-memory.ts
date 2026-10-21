import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import { probeCount, probeNavUrl } from '@/lib/debug/gates-crash-probe';

const HREF_KEY = 'gates:tab-hrefs';
const SEARCH_KEY = 'gates:tab-search';
/** Bumped when tab persistence shape/behavior changes — clears stale broken sessions. */
const TABS_KEY = 'gates:open-tabs-v2';
const MAX_OPEN_TABS = 14;

/** One-shot flags. Persisting them re-opens drawers/modals after reload. */
export const EPHEMERAL_TAB_QUERY_KEYS = ['openDocumentSettings', 'fromAiDraft', 'fromAssemblyDraft'] as const;

export function stripEphemeralTabQuery(search: string): string {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  for (const key of EPHEMERAL_TAB_QUERY_KEYS) params.delete(key);
  return params.toString();
}

export function stripEphemeralTabHref(href: string): string {
  const { path, href: normalized } = splitTabHref(href);
  const q = normalized.indexOf('?');
  if (q === -1) return normalized;
  const cleaned = stripEphemeralTabQuery(normalized.slice(q + 1));
  return cleaned ? `${path}?${cleaned}` : path;
}

const SETTINGS_INTENT_KEY = 'gates:open-doc-settings-intent';

/** Click-to-open settings. Bound to this document load so a browser reload cannot reopen the drawer. */
export function markOpenDocumentSettingsIntent() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SETTINGS_INTENT_KEY, String(performance.timeOrigin));
  } catch {
    /* ignore */
  }
}

export function hasOpenDocumentSettingsIntent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SETTINGS_INTENT_KEY) === String(performance.timeOrigin);
  } catch {
    return false;
  }
}

export function noteOpenDocumentSettingsHref(href: string) {
  const q = href.indexOf('?');
  if (q === -1) return;
  const params = new URLSearchParams(href.slice(q + 1).split('#')[0]);
  if (params.get('openDocumentSettings') === '1') markOpenDocumentSettingsIntent();
}

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
  map[normalized] = stripEphemeralTabHref(href);
  writeMap(HREF_KEY, map);
}

export function recalledTabHref(path: string): string | null {
  const normalized = normalizeAppPath(path);
  const raw = readMap(HREF_KEY)[normalized];
  return raw ? stripEphemeralTabHref(raw) : null;
}

export function rememberTabSearch(path: string, search: string) {
  const normalized = normalizeAppPath(path);
  if (!normalized) return;
  const map = readMap(SEARCH_KEY);
  map[normalized] = stripEphemeralTabQuery(search);
  writeMap(SEARCH_KEY, map);
}

export function recalledTabSearch(path: string): string {
  const normalized = normalizeAppPath(path);
  return stripEphemeralTabQuery(readMap(SEARCH_KEY)[normalized] || '');
}

/** When returning to a tab, prefer a remembered `?id=` over a stale bare tab row. */
export function pickTabReturnHref(path: string, tabHref?: string | null): string {
  const normalized = normalizeAppPath(path);
  const candidates: string[] = [];
  if (tabHref?.trim()) candidates.push(splitTabHref(tabHref.trim()).href);
  const remembered = recalledTabHref(normalized);
  if (remembered?.trim()) candidates.push(splitTabHref(remembered.trim()).href);
  const searchOnly = recalledTabSearch(normalized);
  if (searchOnly) candidates.push(`${normalized}?${searchOnly}`);

  const valid = candidates.filter((href) => normalizeAppPath(splitTabHref(href).path) === normalized);
  const withQuery = valid.find((href) => href.includes('?'));
  if (withQuery) return withQuery;
  return valid[0] ?? normalized;
}

export function pinCurrentWindowHref() {
  if (typeof window === 'undefined') return;
  const path = normalizeAppPath(window.location.pathname);
  const search = stripEphemeralTabQuery(window.location.search.replace(/^\?/, ''));
  const href = search ? `${path}?${search}` : path;
  rememberTabHref(path, href);
  rememberTabSearch(path, search);
}

/** Explicit `?id=` / query wins. Bare paths stay new — do not restore the last document. */
export function resolveAppTabHref(href: string): string {
  const { href: normalized } = splitTabHref(href);
  return normalized;
}

/** Pin the page you are leaving, then go to the destination as given. */
export function destinationAppTabHref(href: string): string {
  probeCount('destinationAppTabHref', { href });
  if (typeof window !== 'undefined') {
    probeNavUrl(`${window.location.pathname}${window.location.search}`, href);
  }
  flushPageDrafts();
  pinCurrentWindowHref();
  noteOpenDocumentSettingsHref(href);
  return resolveAppTabHref(href);
}

export function rememberFreshPage(path: string) {
  const normalized = normalizeAppPath(path);
  if (!normalized) return;
  rememberTabHref(normalized, normalized);
  rememberTabSearch(normalized, '');
}

/** Persist query on the tab (replaceState does not update Next searchParams / tab sync). */
export const TAB_QUERY_PINNED_EVENT = 'gates:tab-query-pinned';

/**
 * Remember `?id=` for a document tab.
 * Never pass `replaceState(null)` — that wipes Next.js router state and breaks every open tab.
 * Never stamp another route: if `pathOverride` is not the live pathname, only sessionStorage is updated.
 */
export function pinTabQuery(search: string, pathOverride?: string) {
  if (typeof window === 'undefined') return;
  const livePath = normalizeAppPath(window.location.pathname);
  const path = normalizeAppPath(pathOverride || livePath);
  if (!path) return;
  const qs = search.replace(/^\?/, '').trim();
  const href = qs ? `${path}?${qs}` : path;
  if (path === livePath) {
    window.history.replaceState(window.history.state ?? null, '', href);
  }
  rememberTabSearch(path, qs);
  rememberTabHref(path, href);
  window.dispatchEvent(new CustomEvent(TAB_QUERY_PINNED_EVENT, { detail: { path, href } }));
}

/** Keep `?id=` on the tab when switching away — recalled on return. */
export function pinDocumentTabQuery(documentId: string | null, pathOverride?: string) {
  pinTabQuery(documentId ? `id=${encodeURIComponent(documentId)}` : '', pathOverride);
}

export function pinInvoiceTabQuery(invoiceId: string | null) {
  pinTabQuery(invoiceId ? `invoiceId=${encodeURIComponent(invoiceId)}` : '');
}

export type PersistedAppTab = {
  path: string;
  href: string;
  label: string;
};

export function persistOpenTabs(tabs: PersistedAppTab[]) {
  if (typeof window === 'undefined') return;
  try {
    if (tabs.length === 0) {
      sessionStorage.removeItem(TABS_KEY);
      return;
    }
    const cleaned = tabs.map((tab) => ({ ...tab, href: stripEphemeralTabHref(tab.href) }));
    sessionStorage.setItem(TABS_KEY, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
}

export function clearTabSessionStorage() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TABS_KEY);
    sessionStorage.removeItem('gates:open-tabs');
    sessionStorage.removeItem(HREF_KEY);
    sessionStorage.removeItem(SEARCH_KEY);
  } catch {
    /* ignore */
  }
}

export { MAX_OPEN_TABS };

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
    const byPath = new Map<string, PersistedAppTab>();
    for (const tab of filtered) {
      const path = normalizeAppPath(tab.path);
      if (!byPath.has(path)) {
        byPath.set(path, { ...tab, path, href: stripEphemeralTabHref(tab.href) });
      }
    }
    return [...byPath.values()];
  } catch {
    return [];
  }
}
