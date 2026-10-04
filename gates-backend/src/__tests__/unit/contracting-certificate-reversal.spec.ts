import { reverseContractingCertificateSchema } from '../../modules/contracting/reversal/contracting-certificate-reversal.schema';
import {
  ACTIVE_SETTLEMENT_BLOCKS_REVERSAL,
  LATER_CERTIFICATE_BLOCKS_REVERSAL,
} from '../../modules/contracting/settlement/contracting-settlement-status';

describe('contracting certificate reversal (P0-4)', () => {
  it('validates reverse payload', () => {
    const parsed = reverseContractingCertificateSchema.parse({
      idempotencyKey: 'idem-key-12345678',
      reason: 'خطأ في الكميات',
    });
    expect(parsed.reason).toBe('خطأ في الكميات');
  });

  it('rejects short idempotency key', () => {
    expect(() =>
      reverseContractingCertificateSchema.parse({
        idempotencyKey: 'short',
        reason: 'سبب',
      })
    ).toThrow();
  });

  it('exports stable guard codes for UI and E2E', () => {
    expect(ACTIVE_SETTLEMENT_BLOCKS_REVERSAL).toBe('ACTIVE_SETTLEMENT_BLOCKS_REVERSAL');
    expect(LATER_CERTIFICATE_BLOCKS_REVERSAL).toBe('LATER_CERTIFICATE_BLOCKS_REVERSAL');
  });
});
