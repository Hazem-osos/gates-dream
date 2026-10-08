import { describe, expect, it } from 'vitest';
import { splitTabHref } from '@/lib/navigation/tab-memory';
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
});
