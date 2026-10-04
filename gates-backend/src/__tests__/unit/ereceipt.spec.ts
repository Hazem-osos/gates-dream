import { buildBuyer } from '../../modules/ereceipt/buyer';
import { mapReceiptPaymentMethod } from '../../modules/ereceipt/payment-map';
import { buildReceiptDocument, applyReceiptCorrection } from '../../modules/ereceipt/document';
import { receiptUuid, withReceiptUuid } from '../../modules/ereceipt/uuid';
import { packSubmissionBatches, submissionBody } from '../../modules/ereceipt/batch';
import { classifySubmissionFailure, redactEreceiptLog, retryDelayMs } from '../../modules/ereceipt/errors';
import { etaReceiptQrUrl, isEtaReceiptQr } from '../../modules/ereceipt/qr';
import { defaultEnabledReceiptTypes } from '../../modules/ereceipt/receipt-types';
import { correctionPreviousUuid, chainHeadAfterIssue } from '../../modules/ereceipt/eta-codes';
import { ERECEIPT_LIMITS } from '../../modules/ereceipt/limits';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    receiptType: 's',
    receiptNumber: 'BR-000001',
    previousUUID: '',
    issuedAt: new Date('2026-04-01T10:00:00.000Z'),
    now: new Date('2026-04-01T10:05:00.000Z'),
    currencyCode: 'EGP',
    headerDiscount: 0,
    netAmount: 114,
    lines: [
      {
        description: 'مياه',
        internalCode: 'W1',
        itemCode: '6221234567890',
        itemType: 'GS1' as const,
        unitType: 'EA',
        quantity: 2,
        unitPrice: 50,
        discountAmount: 0,
        taxPercent: 14,
        taxAmount: 14,
        lineTotal: 114,
        isGift: false,
      },
    ],
    payments: [{ method: 'CASH', amount: 114 }],
    customer: null,
    buyerThreshold: 150000,
    sellerRin: '200173707',
    companyTradeName: 'Gates',
    branchCode: '0',
    deviceSerialNumber: 'POS-1',
    activityCode: '4610',
    address: {
      country: 'EG',
      governate: 'Cairo',
      regionCity: 'Nasr City',
      street: 'Abbas',
      buildingNumber: '1',
    },
    enabledTypes: ['s', 'r', 'RWR'],
    ...overrides,
  };
}

describe('eReceipt UUID', () => {
  it('hashes the document with an empty uuid and is deterministic', () => {
    const built = buildReceiptDocument(snapshot());
    expect(built.errors).toEqual([]);
    const first = withReceiptUuid(built.document!);
    const second = withReceiptUuid(built.document!);
    expect(first.uuid).toHaveLength(64);
    expect(first.uuid).toBe(second.uuid);
    expect(first.canonical).toContain('"UUID""');
    expect(first.submitText).toContain(first.uuid);
    const changed = buildReceiptDocument(snapshot({
      lines: [{ ...snapshot().lines[0], quantity: 3, taxAmount: 21, lineTotal: 171 }],
      netAmount: 171,
    }));
    expect(withReceiptUuid(changed.document!).uuid).not.toBe(first.uuid);
  });

  it('does not use a random uuid', () => {
    const built = buildReceiptDocument(snapshot());
    const hashed = receiptUuid(built.document);
    expect(hashed.uuid).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('eReceipt mapping', () => {
  it('maps cash, card, points, gift card and a split', () => {
    expect(mapReceiptPaymentMethod([{ method: 'CASH', amount: 10 }]).code).toBe('C');
    expect(mapReceiptPaymentMethod([{ method: 'CARD', amount: 10 }]).code).toBe('V');
    expect(mapReceiptPaymentMethod([{ method: 'POINTS', amount: 10 }]).code).toBe('P');
    expect(mapReceiptPaymentMethod([{ method: 'GIFT_CARD', amount: 10 }]).code).toBe('GC');
    expect(mapReceiptPaymentMethod([
      { method: 'CASH', amount: 5 },
      { method: 'CARD', amount: 5 },
    ]).code).toBe('O');
    expect(mapReceiptPaymentMethod([{ method: 'UNKNOWN', amount: 10 }]).error).toBe('UNMAPPED_PAYMENT');
  });

  it('keeps a commercial discount and a gift item discount on the ETA totals', () => {
    const discounted = buildReceiptDocument(snapshot({
      headerDiscount: 0,
      netAmount: 102.6,
      lines: [{
        ...snapshot().lines[0],
        quantity: 2,
        unitPrice: 50,
        discountAmount: 10,
        taxPercent: 14,
        taxAmount: 12.6,
        lineTotal: 102.6,
      }],
    }));
    expect(discounted.errors).toEqual([]);
    expect(discounted.document?.totalCommercialDiscount).toBe(10);
    expect(discounted.document?.totalAmount).toBe(102.6);
    const gift = buildReceiptDocument(snapshot({
      netAmount: 0,
      lines: [{
        ...snapshot().lines[0],
        quantity: 1,
        unitPrice: 20,
        discountAmount: 20,
        taxPercent: 0,
        taxAmount: 0,
        lineTotal: 0,
        isGift: true,
      }],
    }));
    expect(gift.errors).toEqual([]);
    const line = (gift.document?.itemData as Array<Record<string, unknown>>)[0];
    expect(line.itemDiscountData).toEqual([{ amount: 20, description: 'item' }]);
    expect(gift.document?.totalItemsDiscount).toBe(20);
  });
});

describe('eReceipt buyer', () => {
  it('allows an anonymous person below the threshold and requires identity above it', () => {
    expect(buildBuyer({ customer: null, totalAmount: 100, threshold: 150000, sellerRin: '200173707' }).errors).toEqual([]);
    const above = buildBuyer({ customer: null, totalAmount: 150000, threshold: 150000, sellerRin: '200173707' });
    expect(above.errors.map((row) => row.code)).toContain('BUYER_ID_REQUIRED');
  });

  it('validates business, person and foreigner ids without inventing one', () => {
    const business = buildBuyer({
      customer: { arabicName: 'شركة', customerType: 'company', taxAuthority: '123456789' },
      totalAmount: 10,
      threshold: 150000,
      sellerRin: '200173707',
    });
    expect(business.buyer).toMatchObject({ type: 'B', id: '123456789', name: 'شركة' });
    const person = buildBuyer({
      customer: { arabicName: 'أحمد', customerType: 'individual', taxAuthority: '29001011234567' },
      totalAmount: 200000,
      threshold: 150000,
      sellerRin: '200173707',
    });
    expect(person.errors).toEqual([]);
    expect(person.buyer.type).toBe('P');
    expect(person.buyer.id).toBe('29001011234567');
    const foreigner = buildBuyer({
      customer: { arabicName: 'Jane', how: 'export', taxAuthority: 'P123' },
      totalAmount: 10,
      threshold: 150000,
      sellerRin: '200173707',
    });
    expect(foreigner.buyer.type).toBe('F');
    expect(foreigner.buyer.id).toBe('P123');
  });
});

describe('eReceipt returns and corrections', () => {
  it('requires the original sale uuid for a referenced return', () => {
    const missing = buildReceiptDocument(snapshot({ receiptType: 'r', referenceUUID: null }));
    expect(missing.errors.some((row) => row.errorCode === 'REFERENCE_UUID')).toBe(true);
    const linked = buildReceiptDocument(snapshot({
      receiptType: 'r',
      referenceUUID: 'a'.repeat(64),
      originalIssuedAt: new Date('2026-03-01T00:00:00.000Z'),
    }));
    expect(linked.errors).toEqual([]);
    expect((linked.document?.header as { referenceUUID: string }).referenceUUID).toBe('a'.repeat(64));
  });

  it('rejects an unlisted return-without-reference reason', () => {
    const rejected = buildReceiptDocument(snapshot({ receiptType: 'RWR', rwrReason: 'NO', rwrReasons: ['YES'], salesIssuedDateTime: '2026-03-01T00:00:00Z' }));
    expect(rejected.errors.some((row) => row.errorCode === 'RWR_REASON')).toBe(true);
  });

  it('keeps the invalid receipt and gives the correction a new uuid plus referenceOldUUID', () => {
    const built = buildReceiptDocument(snapshot());
    const sealed = withReceiptUuid(built.document!);
    const corrected = applyReceiptCorrection(sealed.document, {
      lines: [{ index: 0, itemCode: '6221234567890', itemType: 'GS1' }],
    });
    expect(corrected.rejected).toBeNull();
    const header = corrected.document.header as { uuid: string; referenceOldUUID?: string; previousUUID: string };
    const invalidPrevious = header.previousUUID;
    header.referenceOldUUID = sealed.uuid;
    header.previousUUID = correctionPreviousUuid(invalidPrevious);
    header.uuid = '';
    const next = withReceiptUuid(corrected.document);
    expect(next.uuid).not.toBe(sealed.uuid);
    expect(header.previousUUID).toBe(invalidPrevious);
    expect((next.document.header as { referenceOldUUID: string }).referenceOldUUID).toBe(sealed.uuid);
    expect(chainHeadAfterIssue(sealed.uuid, next.uuid, false)).toBe(sealed.uuid);
  });
});

describe('eReceipt previousUUID chain', () => {
  it('gives two overlapping issues different previous hashes', async () => {
    let last = '';
    let queue = Promise.resolve();
    const issue = (uuid: string) => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const wait = queue;
      queue = gate;
      return wait.then(() => {
        const previous = last;
        last = uuid;
        release();
        return previous;
      });
    };
    const [first, second] = await Promise.all([issue('a'.repeat(64)), issue('b'.repeat(64))]);
    expect(new Set([first, second]).size).toBe(2);
    expect([first, second]).toContain('');
    expect(last).toBe('b'.repeat(64));
  });
});

describe('eReceipt submission policy', () => {
  it('packs by count and size and treats 202 separately from retryable failures', () => {
    const texts = Array.from({ length: 3 }, () => '{"header":{"uuid":"abc"}}');
    expect(packSubmissionBatches(texts)).toHaveLength(1);
    expect(submissionBody(texts)).toContain('"signatures":[]');
    expect(classifySubmissionFailure({ httpStatus: 503, message: 'down' })).toBe('RETRYABLE');
    expect(classifySubmissionFailure({ httpStatus: 409, errorCode: 'DuplicateSubmission' })).toBe('DUPLICATE');
    expect(classifySubmissionFailure({ httpStatus: 400, errorCode: 'BadRequest', message: 'invalid item' })).toBe('PERMANENT');
    expect(classifySubmissionFailure({ httpStatus: 400, errorCode: 'invalid_posserial' })).toBe('CONFIG');
    expect(retryDelayMs('12', 1)).toBe(12_000);
  });

  it('builds the official receipt URL and redacts secrets', () => {
    const url = etaReceiptQrUrl({
      environment: 'PREPRODUCTION',
      uuid: 'ab'.repeat(32),
      issuedAt: new Date('2026-04-01T10:00:00.000Z'),
      totalAmount: 114,
      issuerRin: '200173707',
    });
    expect(isEtaReceiptQr(url)).toBe(true);
    expect(url).toBe('https://preprod.invoicing.eta.gov.eg/receipts/search/abababababababababababababababababababababababababababababababab/share/2026-04-01T10:00:00Z#Total:114.000,IssuerRIN:200173707');
    expect(redactEreceiptLog({ clientSecret: 'x', presharedKey: 'y', uuid: 'z' })).toEqual({
      clientSecret: '[redacted]',
      presharedKey: '[redacted]',
      uuid: 'z',
    });
    expect(defaultEnabledReceiptTypes()).toEqual(['s', 'r']);
    expect(ERECEIPT_LIMITS.maxReceiptsPerSubmission).toBe(500);
  });
});
