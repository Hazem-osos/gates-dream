import { describe, expect, it, vi } from 'vitest';
import { validateImportedReceiptJson } from '../../modules/ereceipt/import-validate.service';

vi.mock('../../modules/ereceipt/auth', () => ({
  getPosAccessToken: vi.fn(),
  clearPosTokenCache: vi.fn(),
}));

describe('eReceipt UX wiring', () => {
  it('import validate rejects identity override fields', () => {
    const result = validateImportedReceiptJson({
      header: { receiptNumber: '1' },
      itemData: [{ itemCode: 'x' }],
      documentType: { receiptType: 's' },
      previousUUID: 'abc',
      companyId: 'other',
    });
    expect(result.ok).toBe(false);
    expect(result.allowSubmit).toBe(false);
    expect(result.errorsAr.length).toBeGreaterThan(0);
  });

  it('import validate accepts minimal shape without forbidden keys', () => {
    const result = validateImportedReceiptJson({
      header: { receiptNumber: 'BR-000001' },
      itemData: [{ internalCode: '1', itemCode: 'EG-1', unitType: 'EA', quantity: 1 }],
      documentType: { receiptType: 's', version: '1.2' },
    });
    expect(result.ok).toBe(true);
    expect(result.allowSubmit).toBe(false);
    expect(result.preview).not.toBeNull();
  });
});
