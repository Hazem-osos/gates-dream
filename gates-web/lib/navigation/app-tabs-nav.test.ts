import { describe, expect, it, vi } from 'vitest';
import {
  pickTabReturnHref,
  rememberTabHref,
  rememberTabSearch,
  splitTabHref,
} from '@/lib/navigation/tab-memory';
import { tabHrefFromRoute } from '@/lib/navigation/tab-route-sync';

describe('app tab navigation invariants', () => {
  it('sidebar target path matches tab path key', () => {
    const sidebarHref = '/accounting/operations/basic-operations/opening-balance';
    const { path } = splitTabHref(sidebarHref);
    expect(tabHrefFromRoute(path, '')).toBe(path);
  });

  it('route sync href matches router.push destination', () => {
    const dest = '/inventory/creations/item-card?id=9';
    const { path } = splitTabHref(dest);
    expect(tabHrefFromRoute(path, 'id=9')).toBe(dest);
  });

  it('pickTabReturnHref prefers remembered document query over bare tab row', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/inventory/operations/stocktaking', search: '' },
    });
    const bag: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => bag[key] ?? null,
      setItem: (key: string, value: string) => {
        bag[key] = value;
      },
      removeItem: (key: string) => {
        delete bag[key];
      },
      clear: () => {
        for (const key of Object.keys(bag)) delete bag[key];
      },
    });
    const path = '/inventory/operations/stocktaking';
    rememberTabSearch(path, 'id=doc-42');
    rememberTabHref(path, `${path}?id=doc-42`);
    expect(pickTabReturnHref(path, path)).toBe(`${path}?id=doc-42`);
  });

  it('does not prefer a bare href over a stored document query', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/inventory/operations/receipt', search: '' },
    });
    const bag: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => bag[key] ?? null,
      setItem: (key: string, value: string) => {
        bag[key] = value;
      },
      removeItem: (key: string) => {
        delete bag[key];
      },
      clear: () => {
        for (const key of Object.keys(bag)) delete bag[key];
      },
    });
    const path = '/inventory/operations/receipt';
    rememberTabSearch(path, 'id=saved-1');
    rememberTabHref(path, path);
    expect(pickTabReturnHref(path, path)).toBe(`${path}?id=saved-1`);
  });
});
