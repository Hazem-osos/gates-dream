import { describe, expect, it } from 'vitest';
import { packSalesOrderLineNotes, unpackSalesOrderLineNotes } from './sales-order-line-meta';

describe('sales-order-line-meta', () => {
  it('round-trips specifications and image', () => {
    const packed = packSalesOrderLineNotes('مواصفات', 'data:image/jpeg;base64,abc');
    const out = unpackSalesOrderLineNotes(packed);
    expect(out.specifications).toBe('مواصفات');
    expect(out.imageUrl).toBe('data:image/jpeg;base64,abc');
    expect(() => JSON.parse(packed)).not.toThrow();
  });

  it('returns plain text when no image', () => {
    expect(packSalesOrderLineNotes('ملاحظة')).toBe('ملاحظة');
  });
});
