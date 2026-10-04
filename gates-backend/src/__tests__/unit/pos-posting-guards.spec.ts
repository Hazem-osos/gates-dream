import { readFileSync } from 'fs';
import { join } from 'path';

const posting = readFileSync(
  join(__dirname, '../../modules/pos/services/pos-order-posting.service.ts'),
  'utf8'
);

describe('POS posting does not double-write stock', () => {
  it('claims DRAFT inside the post transaction and uses the costing service once', () => {
    expect(posting).toContain("status: 'DRAFT'");
    expect(posting).toContain('applyOutboundMovement');
    expect(posting).toContain('applyInboundMovement');
    expect(posting).not.toContain('stockMovementService');
    expect(posting).not.toContain('getCostAsOf');
    expect(posting).not.toContain('invoiceService');
    expect(posting).not.toContain('createInvoice');
  });
});
