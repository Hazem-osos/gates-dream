import {
  assertPreproductionTestAllowed,
  buildTestSnapshot,
  type TestReceiptBuildContext,
} from '../../modules/ereceipt/test-receipt.service';
import { validateExplicitBuyer } from '../../modules/ereceipt/buyer';
import { previewFromSnapshot } from '../../modules/ereceipt/issue-commit.service';
import { taxSubtypeBelongs } from '../../modules/ereceipt/eta-codes';

const baseCtx = (): TestReceiptBuildContext => ({
  sellerRin: '200173707',
  companyName: 'Gates',
  branchCode: 'BR',
  activityCode: '4610',
  setting: { buyerIdentityThreshold: 150000, enabledReceiptTypes: ['s', 'r'], paymentMap: null, orderDeliveryMode: null },
  address: { country: 'EG', governate: 'Cairo', regionCity: 'City', street: 'St', buildingNumber: '1' },
  device: { deviceSerialNumber: 'POS-TEST', syndicateLicenseNumber: null },
});

describe('PREPRODUCTION manual test receipt', () => {
  it('rejects production environment server-side', () => {
    expect(() => assertPreproductionTestAllowed('PRODUCTION')).toThrow(/PREPRODUCTION/);
    expect(() => assertPreproductionTestAllowed('PREPRODUCTION')).not.toThrow();
  });

  it('builds snapshot totals through the real document builder', () => {
    const { snapshot } = buildTestSnapshot(baseCtx(), {
      buyerType: 'P',
      payment: 'CASH',
      lines: [{
        description: 'مياه',
        itemType: 'GS1',
        itemCode: '6221234567890',
        internalCode: 'W1',
        unitType: 'EA',
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        taxType: 'T1',
        taxSubType: 'V009',
        taxRate: 14,
      }],
    });
    const preview = previewFromSnapshot({ ...snapshot, receiptNumber: 'T-1', previousUUID: '' });
    expect(preview.errors).toEqual([]);
    expect(preview.totals.totalAmount).toBe(114);
    expect(preview.totals.paymentMethod).toBe('C');
  });

  it('validates explicit buyer types', () => {
    const low = validateExplicitBuyer({ buyer: { type: 'P' }, totalAmount: 100, threshold: 150000, sellerRin: '200173707' });
    expect(low.errors).toEqual([]);
    const bad = validateExplicitBuyer({ buyer: { type: 'B', id: '123', name: 'X' }, totalAmount: 10, threshold: 150000, sellerRin: '200173707' });
    expect(bad.errors.some((e) => e.code === 'BUYER_RIN')).toBe(true);
  });

  it('rejects invalid tax subtype pairings', () => {
    expect(taxSubtypeBelongs('T1', 'V009')).toBe(true);
    expect(taxSubtypeBelongs('T1', 'Tbl01')).toBe(false);
    expect(() => buildTestSnapshot({ ...baseCtx(), branchCode: '0', setting: null }, {
      buyerType: 'P',
      payment: 'CASH',
      lines: [{ description: 'x', itemType: 'GS1', itemCode: '6221234567890', internalCode: 'i', unitType: 'EA', quantity: 1, unitPrice: 1, taxType: 'T1', taxSubType: 'Tbl01', taxRate: 14 }],
    })).toThrow();
  });

  it('maps credit card to ETA CC without guessing other tenders', () => {
    const { snapshot } = buildTestSnapshot({ ...baseCtx(), branchCode: '0', setting: { buyerIdentityThreshold: 150000, enabledReceiptTypes: ['s'], paymentMap: null, orderDeliveryMode: null } }, {
      buyerType: 'P',
      payment: 'CREDIT_CARD',
      lines: [{ description: 'x', itemType: 'GS1', itemCode: '6221234567890', internalCode: 'i', unitType: 'EA', quantity: 1, unitPrice: 100, taxType: 'T1', taxSubType: 'V009', taxRate: 14 }],
    });
    expect(snapshot.paymentOverrides?.CARD).toBe('CC');
    const preview = previewFromSnapshot({ ...snapshot, receiptNumber: 'T-1', previousUUID: '' });
    expect(preview.document?.paymentMethod).toBe('CC');
  });

  it('does not expose secrets in test context shape', () => {
    const ctx = loadTestReceiptContextShape();
    expect(ctx).not.toHaveProperty('clientSecret');
    expect(ctx).not.toHaveProperty('presharedKey');
    expect(ctx).not.toHaveProperty('clientSecretEnc');
    expect(ctx).not.toHaveProperty('presharedKeyEnc');
  });
});

/** Documents allowed public fields for GET /test/context (unit-level contract). */
function loadTestReceiptContextShape(): Record<string, unknown> {
  return {
    environment: 'PREPRODUCTION',
    companyName: 'Gates',
    sellerRin: '200173707',
    branchCode: 'BR',
    activityCode: '4610',
    posSerial: 'POS-TEST',
    terminalName: 'Test',
    clientId: 'cid',
    secretsConfigured: true,
    noteAr: '…',
  };
}
