import { describe, expect, it } from 'vitest';
import { HIDDEN_MODULE_KEYS, isRouteUnavailable } from '@/lib/navigation/route-visibility';

describe('route-visibility', () => {
  it('marks configured prefixes unavailable', () => {
    expect(isRouteUnavailable('/importexport')).toBe(true);
    expect(isRouteUnavailable('/importexport/foo')).toBe(true);
    expect(isRouteUnavailable('/inventory/items')).toBe(false);
  });

  it('does not hide manufacturing module root', () => {
    expect(isRouteUnavailable('/manufacturing')).toBe(false);
    expect(isRouteUnavailable('/manufacturing/operations/production-planning')).toBe(false);
  });

  it('hides only the staged BOM placeholder path', () => {
    expect(isRouteUnavailable('/manufacturing/creations/manufacturing-stages')).toBe(true);
  });

  it('hides removed inventory adjustment screen', () => {
    expect(isRouteUnavailable('/inventory/operations/adjustment')).toBe(true);
    expect(isRouteUnavailable('/inventory/operations/adjustment?id=1')).toBe(true);
  });

  it('keeps importexport module key hidden from switcher set', () => {
    expect(HIDDEN_MODULE_KEYS.has('importexport')).toBe(true);
    expect(HIDDEN_MODULE_KEYS.has('manufacturing')).toBe(false);
  });
});
