import { sanitizeBackupValue } from '../../modules/company/services/tenant-backup.service';

describe('sanitizeBackupValue', () => {
  it('strips secret-like keys and serializes dates', () => {
    const cleaned = sanitizeBackupValue({
      arabicName: 'عميل',
      password: 'x',
      clientSecret: 'y',
      taxSignature: 'sig',
      createdAt: new Date('2026-09-09T00:00:00.000Z'),
    }) as Record<string, unknown>;
    expect(cleaned.arabicName).toBe('عميل');
    expect(cleaned.password).toBeUndefined();
    expect(cleaned.clientSecret).toBeUndefined();
    expect(cleaned.taxSignature).toBeUndefined();
    expect(cleaned.createdAt).toBe('2026-09-09T00:00:00.000Z');
  });
});
