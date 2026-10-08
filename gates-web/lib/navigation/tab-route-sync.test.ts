import { describe, expect, it } from 'vitest';
import { tabHrefFromRoute } from '@/lib/navigation/tab-route-sync';

describe('tabHrefFromRoute', () => {
  it('builds path-only and query hrefs', () => {
    expect(tabHrefFromRoute('/accounting/', '')).toBe('/accounting');
    expect(tabHrefFromRoute('/inventory/items', 'id=3')).toBe('/inventory/items?id=3');
    expect(tabHrefFromRoute(null, 'id=1')).toBeNull();
  });
});
