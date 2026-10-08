import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOpenTabs, persistOpenTabs, splitTabHref } from '@/lib/navigation/tab-memory';

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
});
