import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasOpenDocumentSettingsIntent,
  loadOpenTabs,
  markOpenDocumentSettingsIntent,
  persistOpenTabs,
  pinDocumentTabQuery,
  pinTabQuery,
  rememberTabHref,
  rememberTabSearch,
  recalledTabHref,
  recalledTabSearch,
  splitTabHref,
  stripEphemeralTabHref,
  stripEphemeralTabQuery,
} from '@/lib/navigation/tab-memory';

describe('splitTabHref', () => {
  it('normalizes paths and query', () => {
    expect(splitTabHref('/inventory/foo/')).toEqual({
      path: '/inventory/foo',
      href: '/inventory/foo',
    });
    expect(splitTabHref('/inventory/foo?id=1')).toEqual({
      path: '/inventory/foo',
      href: '/inventory/foo?id=1',
    });
  });
});

describe('loadOpenTabs', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '' },
    });
  });

  it('dedupes persisted tabs by path on load', () => {
    persistOpenTabs([
      { path: '/accounting', href: '/accounting', label: 'A' },
      { path: '/accounting', href: '/accounting?id=2', label: 'A2' },
      { path: '/inventory', href: '/inventory', label: 'I' },
    ]);
    const loaded = loadOpenTabs();
    expect(loaded).toHaveLength(2);
    expect(loaded.map((t) => t.path).sort()).toEqual(['/accounting', '/inventory']);
  });

  it('strips openDocumentSettings from remembered tab search and href', () => {
    rememberTabSearch(
      '/inventory/operations/sales-invoice',
      'id=abc&openDocumentSettings=1&fromAiDraft=1'
    );
    rememberTabHref(
      '/inventory/operations/sales-invoice',
      '/inventory/operations/sales-invoice?id=abc&openDocumentSettings=1'
    );
    expect(recalledTabSearch('/inventory/operations/sales-invoice')).toBe('id=abc');
    expect(recalledTabHref('/inventory/operations/sales-invoice')).toBe(
      '/inventory/operations/sales-invoice?id=abc'
    );
  });

  it('strips openDocumentSettings from persisted open tabs on load', () => {
    persistOpenTabs([
      {
        path: '/inventory/operations/sales-invoice',
        href: '/inventory/operations/sales-invoice?openDocumentSettings=1',
        label: 'فاتورة مبيعات',
      },
    ]);
    expect(loadOpenTabs()).toEqual([
      {
        path: '/inventory/operations/sales-invoice',
        href: '/inventory/operations/sales-invoice',
        label: 'فاتورة مبيعات',
      },
    ]);
  });
});

describe('stripEphemeralTabQuery', () => {
  it('drops one-shot flags and keeps document ids', () => {
    expect(stripEphemeralTabQuery('id=1&openDocumentSettings=1')).toBe('id=1');
    expect(stripEphemeralTabQuery('openDocumentSettings=1')).toBe('');
    expect(stripEphemeralTabHref('/inventory/operations/sales-invoice?openDocumentSettings=1')).toBe(
      '/inventory/operations/sales-invoice'
    );
  });
});

describe('pinTabQuery', () => {
  const store: Record<string, string> = {};
  let historyState: unknown = { idx: 3, as: '/inventory/operations/sales-invoice' };
  let replaced: { state: unknown; url: string } | null = null;
  let locationPath = '/inventory/operations/sales-invoice';

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    historyState = { idx: 3, as: '/inventory/operations/sales-invoice' };
    replaced = null;
    locationPath = '/inventory/operations/sales-invoice';
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
    vi.stubGlobal('window', {
      location: {
        get pathname() {
          return locationPath;
        },
      },
      history: {
        get state() {
          return historyState;
        },
        replaceState: (state: unknown, _title: string, url: string) => {
          historyState = state;
          replaced = { state, url };
        },
      },
      dispatchEvent: () => true,
    });
  });

  it('keeps Next router history state and writes the full path', () => {
    pinTabQuery('id=paper-1');
    expect(replaced).toEqual({
      state: { idx: 3, as: '/inventory/operations/sales-invoice' },
      url: '/inventory/operations/sales-invoice?id=paper-1',
    });
    expect(historyState).toEqual({ idx: 3, as: '/inventory/operations/sales-invoice' });
  });

  it('does not stamp another live route when pinning a paper path', () => {
    pinDocumentTabQuery('paper-9', '/accounting/operations/securities/receipt');
    expect(replaced).toBeNull();
    expect(recalledTabHref('/accounting/operations/securities/receipt')).toBe(
      '/accounting/operations/securities/receipt?id=paper-9'
    );
    expect(recalledTabSearch('/inventory/operations/sales-invoice')).toBe('');
  });
});

describe('open document settings intent', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
    vi.stubGlobal('window', { location: { pathname: '/', search: '' } });
    vi.stubGlobal('performance', { timeOrigin: 1000 });
  });

  it('is valid for this document load and invalid after a reload', () => {
    expect(hasOpenDocumentSettingsIntent()).toBe(false);
    markOpenDocumentSettingsIntent();
    expect(hasOpenDocumentSettingsIntent()).toBe(true);
    vi.stubGlobal('performance', { timeOrigin: 2000 });
    expect(hasOpenDocumentSettingsIntent()).toBe(false);
  });
});
