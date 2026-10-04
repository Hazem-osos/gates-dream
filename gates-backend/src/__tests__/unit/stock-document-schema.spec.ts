import { createReceiptSchema } from '../../modules/inventory/schemas/receipt.schema';
import { createIssueSchema } from '../../modules/inventory/schemas/issue.schema';

const warehouseId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';

describe('stock document schemas', () => {
  it('accepts a date-only receipt and numeric strings', () => {
    const parsed = createReceiptSchema.parse({
      date: '2026-10-04',
      warehouseId,
      lines: [{ itemId, quantity: '2', unitPrice: '10.5' }],
    });
    expect(parsed.date).toBe('2026-10-04T00:00:00.000Z');
    expect(parsed.lines[0]?.quantity).toBe(2);
    expect(parsed.lines[0]?.unitPrice).toBe(10.5);
  });

  it('accepts a date-only issue and coerces quantities', () => {
    const parsed = createIssueSchema.parse({
      date: '2026-10-04',
      warehouseId,
      lines: [{ itemId, quantity: '1' }],
    });
    expect(parsed.date).toBe('2026-10-04T00:00:00.000Z');
    expect(parsed.lines[0]?.quantity).toBe(1);
  });
});
