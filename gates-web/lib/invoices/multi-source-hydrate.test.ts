import { describe, expect, it } from 'vitest';
import { combineSourceHydrateLines, type SourceHydrateLine } from '@/lib/invoices/multi-source-hydrate';

const line = (itemId: string, qty: number, price = 10): SourceHydrateLine => ({
  itemId,
  itemName: itemId,
  quantity: qty,
  unitPrice: price,
  taxRate: 0,
  withholdingTaxRate: 0,
  discount: 0,
});

describe('combineSourceHydrateLines', () => {
  it('keeps duplicate items as separate rows in separate mode', () => {
    const out = combineSourceHydrateLines([[line('a', 2), line('a', 3)]], 'separate');
    expect(out).toHaveLength(2);
    expect(out[0].quantity).toBe(2);
    expect(out[1].quantity).toBe(3);
  });

  it('merges same item and unit in merge_similar mode', () => {
    const out = combineSourceHydrateLines([[line('a', 2, 10), line('a', 3, 20)]], 'merge_similar');
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(5);
    expect(out[0].unitPrice).toBe(16);
  });
});
