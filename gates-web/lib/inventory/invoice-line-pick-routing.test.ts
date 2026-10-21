import { describe, expect, it } from 'vitest';
import {
  compactInvoiceEntryLines,
  planInvoiceLineItemPick,
  resolveInvoiceLinePickIndex,
} from './invoice-line-pick-routing';

type Row = { itemId?: string; quantity?: number };

const blank = (): Row => ({ itemId: '', quantity: 1 });

describe('invoice-line-pick-routing', () => {
  it('prefers first empty row over a lower index', () => {
    const lines: Row[] = [{ itemId: '' }, { itemId: '' }];
    expect(resolveInvoiceLinePickIndex(lines, 1, 'item-a')).toBe(0);
  });

  it('prefers first duplicate row', () => {
    const lines: Row[] = [{ itemId: 'item-a', quantity: 2 }, { itemId: '' }];
    expect(resolveInvoiceLinePickIndex(lines, 1, 'item-a')).toBe(0);
  });

  it('merges duplicate picks into the first row', () => {
    const out = planInvoiceLineItemPick(
      [{ itemId: 'a', quantity: 2 }, { itemId: '' }],
      1,
      'a',
      blank
    );
    expect(out.mergedDuplicate).toBe(true);
    expect(out.lines.filter((l) => l.itemId === 'a')).toHaveLength(1);
    expect(out.lines[0].quantity).toBe(3);
    expect(out.lines[out.lines.length - 1].itemId).toBe('');
  });

  it('compacts empty rows and keeps one trailing blank', () => {
    const out = compactInvoiceEntryLines(
      [{ itemId: 'a' }, { itemId: '' }, { itemId: '' }],
      blank
    );
    expect(out).toHaveLength(2);
    expect(out[0].itemId).toBe('a');
    expect(out[1].itemId).toBe('');
  });
});
