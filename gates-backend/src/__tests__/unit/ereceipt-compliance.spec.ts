import { buildBuyer } from '../../modules/ereceipt/buyer';
import { ETA_PAYMENT_CODES, mapReceiptPaymentMethod } from '../../modules/ereceipt/payment-map';
import { buildReceiptDocument } from '../../modules/ereceipt/document';
import { receiptUuid, withReceiptUuid } from '../../modules/ereceipt/uuid';
import { packSubmissionBatches, submissionBody } from '../../modules/ereceipt/batch';
import { classifySubmissionFailure, redactEreceiptLog, retryDelayMs } from '../../modules/ereceipt/errors';
import { flattenEtaErrors } from '../../modules/ereceipt/submit.service';
import { etaReceiptQrUrl } from '../../modules/ereceipt/qr';
import { defaultEnabledReceiptTypes, issuedReceiptType, RECEIPT_TYPE_REGISTRY } from '../../modules/ereceipt/receipt-types';
import { branchNumberKey, chainHeadAfterIssue, correctionPreviousUuid, deviceChainKey, taxSubtypeBelongs } from '../../modules/ereceipt/eta-codes';
import { ERECEIPT_LIMITS } from '../../modules/ereceipt/limits';

function line(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

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
    lines: [line()],
    payments: [{ method: 'CASH', amount: 114 }],
    customer: null,
    buyerThreshold: 150000,
    sellerRin: '200173707',
    companyTradeName: 'Gates',
    branchCode: '0',
    deviceSerialNumber: 'POS-1',
    activityCode: '4610',
    address: { country: 'EG', governate: 'Cairo', regionCity: 'Nasr City', street: 'Abbas', buildingNumber: '1' },
    enabledTypes: ['s', 'r', 'RWR'],
    ...overrides,
  };
}

describe('eReceipt document coverage', () => {
  it('sends required receipt fields and omits reserved optional totals', () => {
    const built = buildReceiptDocument(snapshot());
    expect(built.errors).toEqual([]);
    const doc = built.document!;
    expect(doc.feesAmount).toBeUndefined();
    expect(doc.adjustment).toBeUndefined();
    expect(doc.contractor).toBeUndefined();
    expect(doc.beneficiary).toBeUndefined();
    const header = doc.header as Record<string, unknown>;
    expect(header.uuid).toBe('');
    expect(header.dateTimeIssued).toBe('2026-04-01T10:00:00Z');
    expect(header.sOrderNameCode).toBeUndefined();
    expect((doc.documentType as { receiptType: string; typeVersion: string }).typeVersion).toBe('1.2');
  });

  it('includes optional fields only when a real value is supplied', () => {
    const withOptional = buildReceiptDocument(snapshot({
      paymentNumber: 'AUTH1',
      salesOrderCode: 'POS-9',
      lines: [line({ discountAmount: 10, discountPercent: 10, taxAmount: 12.6, lineTotal: 102.6, valueDifference: 1 })],
      netAmount: 102.6,
    }));
    expect(withOptional.errors).toEqual([]);
    const header = withOptional.document!.header as Record<string, unknown>;
    expect(header.sOrderNameCode).toBe('POS-9');
    expect((withOptional.document!.buyer as { paymentNumber?: string }).paymentNumber).toBe('AUTH1');
    const item = (withOptional.document!.itemData as Array<Record<string, unknown>>)[0];
    expect(item.valueDifference).toBe(1);
    expect((item.commercialDiscountData as Array<{ rate?: number }>)[0].rate).toBe(10);
  });

  it('rejects a sale that carries a return reference and a receipt over 300 lines', () => {
    const referenced = buildReceiptDocument(snapshot({ referenceUUID: 'a'.repeat(64) }));
    expect(referenced.errors.some((row) => row.errorCode === 'REFERENCE_ON_SALE')).toBe(true);
    const tooMany = buildReceiptDocument(snapshot({ lines: Array.from({ length: 301 }, () => line()) }));
    expect(tooMany.errors.some((row) => row.errorCode === 'LINE_COUNT')).toBe(true);
    const boundary = buildReceiptDocument(snapshot({
      lines: Array.from({ length: 300 }, () => line()),
      netAmount: 114 * 300,
    }));
    expect(boundary.errors).toEqual([]);
  });

  it('requires a delivery mode only for receipt types whose page marks it mandatory', () => {
    const retail = buildReceiptDocument(snapshot({ receiptType: 'SR', enabledTypes: ['SR'] }));
    expect(retail.errors.some((row) => row.errorCode === 'DELIVERY_MODE')).toBe(true);
    const withMode = buildReceiptDocument(snapshot({ receiptType: 'SR', enabledTypes: ['SR'], orderDeliveryMode: 'FC' }));
    expect(withMode.errors.some((row) => row.errorCode === 'DELIVERY_MODE')).toBe(false);
  });
});

describe('eReceipt serialization rules', () => {
  it('keeps uuid empty, repeats array names, and preserves Arabic and decimals', () => {
    const built = buildReceiptDocument(snapshot({
      lines: [line({ unitPrice: 10.5, quantity: 1, taxAmount: 1.47, lineTotal: 11.97, description: 'مياه معدنية' })],
      netAmount: 11.97,
    }));
    const hashed = receiptUuid(built.document);
    expect(hashed.uuid).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed.canonical).toContain('"UUID""');
    expect(hashed.canonical).toContain('"ITEMDATA"');
    expect(hashed.canonical).toContain('مياه معدنية');
    expect(hashed.canonical).toContain('"10.5"');
    expect(hashed.canonical).not.toContain(hashed.uuid);
    const again = withReceiptUuid(built.document!);
    expect(again.uuid).toBe(hashed.uuid);
  });
});

describe('eReceipt chain and receipt number scope', () => {
  it('scopes previousUUID by device and environment, and receipt numbers by branch', () => {
    const deviceA = deviceChainKey('co', 'terminal-a', 'PREPRODUCTION');
    const deviceB = deviceChainKey('co', 'terminal-b', 'PREPRODUCTION');
    const otherEnv = deviceChainKey('co', 'terminal-a', 'PRODUCTION');
    expect(deviceA).not.toBe(deviceB);
    expect(deviceA).not.toBe(otherEnv);
    expect(branchNumberKey('co', 'PREPRODUCTION', '0')).toBe(branchNumberKey('co', 'PREPRODUCTION', '0'));
    expect(branchNumberKey('co', 'PREPRODUCTION', '0')).not.toBe(branchNumberKey('co', 'PREPRODUCTION', '1'));
    expect(chainHeadAfterIssue('head', 'new', false)).toBe('head');
    expect(chainHeadAfterIssue('head', 'new', true)).toBe('new');
    expect(correctionPreviousUuid('')).toBe('');
    expect(correctionPreviousUuid('a'.repeat(64))).not.toBe('b'.repeat(64));
  });
});

describe('eReceipt buyer rules', () => {
  it('applies the v1.2 identity threshold and rejects an invalid business or foreign id', () => {
    const below = buildBuyer({ customer: null, totalAmount: 149999, threshold: 150000, sellerRin: '200173707' });
    expect(below.errors).toEqual([]);
    expect(below.buyer.type).toBe('P');
    const above = buildBuyer({ customer: null, totalAmount: 150000, threshold: 150000, sellerRin: '200173707' });
    expect(above.errors.some((row) => row.code === 'BUYER_ID_REQUIRED')).toBe(true);
    const business = buildBuyer({
      customer: { customerType: 'company', arabicName: 'Shop', taxAuthority: '123' },
      totalAmount: 10,
      threshold: 150000,
      sellerRin: '200173707',
    });
    expect(business.buyer.type).toBe('B');
    expect(business.errors.some((row) => row.code === 'BUYER_RIN')).toBe(true);
    const foreign = buildBuyer({
      customer: { how: 'export', arabicName: 'Ann', taxAuthority: 'P123' },
      totalAmount: 10,
      threshold: 150000,
      sellerRin: '200173707',
    });
    expect(foreign.buyer.type).toBe('F');
    expect(foreign.errors).toEqual([]);
  });
});

describe('eReceipt taxes and discounts', () => {
  it('accepts an official extra tax subtype and rejects a mismatched subtype', () => {
    expect(taxSubtypeBelongs('T1', 'V009')).toBe(true);
    expect(taxSubtypeBelongs('T3', 'Tbl02')).toBe(true);
    expect(taxSubtypeBelongs('T1', 'Tbl01')).toBe(false);
    const extra = buildReceiptDocument(snapshot({
      lines: [line({ extraTaxes: [{ taxType: 'T2', subType: 'Tbl01', amount: 1, rate: 0 }], taxAmount: 14, lineTotal: 115 })],
      netAmount: 115,
    }));
    expect(extra.errors).toEqual([]);
    const mismatched = buildReceiptDocument(snapshot({
      lines: [line({ extraTaxes: [{ taxType: 'T1', subType: 'Tbl01', amount: 1 }] })],
    }));
    expect(mismatched.errors.some((row) => row.errorCode === 'TAX_SUBTYPE')).toBe(true);
  });

  it('maps a line discount, a gift, and a receipt discount separately', () => {
    const commercial = buildReceiptDocument(snapshot({
      lines: [line({ discountAmount: 10, taxAmount: 12.6, lineTotal: 102.6 })],
      headerDiscount: 2,
      netAmount: 100.6,
    }));
    expect(commercial.errors).toEqual([]);
    expect(commercial.document!.extraReceiptDiscountData).toEqual([{ amount: 2, description: 'receipt' }]);
    const gift = buildReceiptDocument(snapshot({
      lines: [line({ isGift: true, discountAmount: 100, taxPercent: 0, taxAmount: 0, lineTotal: 0, unitPrice: 50, quantity: 2 })],
      netAmount: 0,
      payments: [{ method: 'CASH', amount: 0.01 }],
    }));
    expect(gift.errors.filter((row) => row.errorCode === 'NO_PAYMENT')).toEqual([]);
  });
});

describe('eReceipt payments', () => {
  it('covers every official payment code without guessing contractor or promotion codes', () => {
    expect(ETA_PAYMENT_CODES).toEqual(['C', 'V', 'CC', 'VC', 'VO', 'PR', 'GC', 'P', 'O']);
    expect(mapReceiptPaymentMethod([{ method: 'CASH', amount: 1 }]).code).toBe('C');
    expect(mapReceiptPaymentMethod([{ method: 'CARD', amount: 1 }]).code).toBe('V');
    expect(mapReceiptPaymentMethod([{ method: 'VOUCHER', amount: 1 }]).code).toBe('VO');
    expect(mapReceiptPaymentMethod([{ method: 'GIFT_CARD', amount: 1 }]).code).toBe('GC');
    expect(mapReceiptPaymentMethod([{ method: 'POINTS', amount: 1 }]).code).toBe('P');
    expect(mapReceiptPaymentMethod([{ method: 'BANK', amount: 1 }]).code).toBe('O');
    expect(mapReceiptPaymentMethod([
      { method: 'CASH', amount: 1 },
      { method: 'CARD', amount: 1 },
    ]).code).toBe('O');
    expect(mapReceiptPaymentMethod([{ method: 'CASH', amount: 1 }], { CASH: 'CC' }).code).toBe('CC');
    expect(mapReceiptPaymentMethod([{ method: 'CASH', amount: 1 }], { CASH: 'XX' }).error).toBe('UNMAPPED_PAYMENT');
  });
});

describe('eReceipt returns, RWR and receipt types', () => {
  it('keeps industry types disabled and uses s or r while those codes stay enabled', () => {
    expect(defaultEnabledReceiptTypes()).toEqual(['s', 'r']);
    expect(issuedReceiptType('sale', ['s', 'SR'])).toBe('s');
    expect(issuedReceiptType('sale', ['SR'])).toBe('SR');
    expect(RECEIPT_TYPE_REGISTRY.some((row) => row.code === 'RWR' && row.defaultEnabled === false)).toBe(true);
    expect(RECEIPT_TYPE_REGISTRY.filter((row) => row.version !== '1.2')).toEqual([]);
  });

  it('rejects a referenced return outside 540 days and an unconfigured RWR reason', () => {
    const late = buildReceiptDocument(snapshot({
      receiptType: 'r',
      referenceUUID: 'a'.repeat(64),
      originalIssuedAt: new Date('2024-01-01T00:00:00.000Z'),
      now: new Date('2026-04-01T00:00:00.000Z'),
    }));
    expect(late.errors.some((row) => row.errorCode === 'RETURN_WINDOW')).toBe(true);
    const rwr = buildReceiptDocument(snapshot({
      receiptType: 'RWR',
      rwrReason: 'I',
      rwrReasons: ['I'],
      salesIssuedDateTime: '2024-01-01T00:00:00Z',
    }));
    expect(rwr.errors).toEqual([]);
    const disabled = buildReceiptDocument(snapshot({
      receiptType: 'RWR',
      rwrReason: 'I',
      rwrReasons: [],
      salesIssuedDateTime: '2024-01-01T00:00:00Z',
    }));
    expect(disabled.errors.some((row) => row.errorCode === 'RWR_REASON')).toBe(true);
  });
});

describe('eReceipt submission, status and secrets', () => {
  it('packs the 500 and byte limits and classifies duplicate, auth and server failures', () => {
    const texts = Array.from({ length: 501 }, () => '{"a":1}');
    expect(packSubmissionBatches(texts).length).toBeGreaterThan(1);
    expect(packSubmissionBatches(texts)[0]).toHaveLength(500);
    const bulky = 'x'.repeat(ERECEIPT_LIMITS.maxSubmissionBytes);
    expect(() => packSubmissionBatches([`{"body":"${bulky}"}`])).toThrow('ERECEIPT_RECEIPT_TOO_LARGE');
    expect(submissionBody(['{"header":{}}'])).toContain('"signatures":[]');
    expect(classifySubmissionFailure({ httpStatus: 422, errorCode: 'DuplicateSubmission' })).toBe('DUPLICATE');
    expect(classifySubmissionFailure({ httpStatus: 401, errorCode: 'invalid_posserial' })).toBe('CONFIG');
    expect(classifySubmissionFailure({ httpStatus: 500, message: 'down' })).toBe('RETRYABLE');
    expect(classifySubmissionFailure({ httpStatus: 0, message: 'timeout' })).toBe('RETRYABLE');
    expect(retryDelayMs('30', 2)).toBe(30_000);
    const errors = flattenEtaErrors({
      validationResults: {
        validationSteps: [{
          name: 'item',
          errors: [{ errorCode: 'ITEM_CODE', propertyPath: 'itemData[0].itemCode', message: 'bad', innerError: [{ error: 'تفاصيل' }] }],
        }],
      },
    });
    expect(errors[0]).toMatchObject({ errorCode: 'ITEM_CODE', propertyPath: 'itemData[0].itemCode', messageAr: 'تفاصيل' });
    expect(redactEreceiptLog({ accessToken: 'secret-token', nested: { clientSecret: 's' } })).toEqual({
      accessToken: '[redacted]',
      nested: { clientSecret: '[redacted]' },
    });
  });

  it('builds the production QR fragment from the issuance FAQ', () => {
    const url = etaReceiptQrUrl({
      environment: 'PRODUCTION',
      uuid: 'ab'.repeat(32),
      issuedAt: new Date('2022-02-19T02:00:00.000Z'),
      totalAmount: 1000,
      issuerRin: '674859545',
    });
    expect(url).toBe('https://invoicing.eta.gov.eg/receipts/search/abababababababababababababababababababababababababababababababab/share/2022-02-19T02:00:00Z#Total:1000.000,IssuerRIN:674859545');
  });
});
