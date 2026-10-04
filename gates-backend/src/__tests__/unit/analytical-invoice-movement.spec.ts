import {
  analyticalLineStatus,
  buildAnalyticalInvoiceMovement,
  commercialIssuedQty,
  type AnalyticalLineDraft,
} from '../../modules/invoices/services/analytical-invoice-movement';

function draft(overrides: Partial<AnalyticalLineDraft> = {}): AnalyticalLineDraft {
  return {
    id: 'line-1',
    sourceType: 'QUOTATION',
    sourceTypeLabel: 'عرض سعر',
    sourceNumber: 'Q-1',
    sourceDate: '2026-03-01T00:00:00.000Z',
    partyName: 'عميل',
    itemName: 'صنف',
    unitName: 'قطعة',
    orderedQty: 10,
    orderedBaseQty: 10,
    unitPrice: 5,
    orderedTotal: 50,
    issuedBaseQty: 0,
    headerConverted: false,
    invoiceNumber: '',
    invoiceId: null,
    cancelled: false,
    sourcePreviewPath: null,
    invoicePreviewPath: null,
    ...overrides,
  };
}

describe('analytical invoice movement', () => {
  it('converts a partial issue of 5 from a quote line of 10', () => {
    const line = draft({ issuedBaseQty: 5 });
    expect(commercialIssuedQty(line)).toBe(5);
    expect(analyticalLineStatus(10, 5, false)).toBe('جزئي');

    const report = buildAnalyticalInvoiceMovement([line], { page: 1, limit: 50 });
    expect(report.rows[0]).toMatchObject({
      sourceTypeLabel: 'عرض سعر',
      orderedQty: 10,
      issuedQty: 5,
      remainingQty: 5,
      status: 'جزئي',
    });
    expect(report.summary.issuedQty).toBe(5);
    expect(report.summary.remainingQty).toBe(5);
  });

  it('scales issued base quantity back to the line unit', () => {
    const issued = commercialIssuedQty(
      draft({ orderedQty: 2, orderedBaseQty: 10, issuedBaseQty: 5 })
    );
    expect(issued).toBe(1);
  });

  it('treats a header conversion without line sources as fully issued', () => {
    const report = buildAnalyticalInvoiceMovement(
      [draft({ headerConverted: true, invoiceNumber: 'S-9' })],
      { page: 1, limit: 50 }
    );
    expect(report.rows[0]).toMatchObject({
      issuedQty: 10,
      remainingQty: 0,
      status: 'مكتمل',
      invoiceNumber: 'S-9',
    });
  });

  it('keeps a cancelled source out of the quantity totals', () => {
    const report = buildAnalyticalInvoiceMovement(
      [draft({ cancelled: true, issuedBaseQty: 5 })],
      { page: 1, limit: 50 }
    );
    expect(report.rows[0].status).toBe('ملغي');
    expect(report.summary.issuedQty).toBe(0);
    expect(report.summary.orderedQty).toBe(0);
  });

  it('filters by item text and by the full-conversion status', () => {
    const report = buildAnalyticalInvoiceMovement(
      [
        draft({ id: 'a', itemName: 'قماش', issuedBaseQty: 10 }),
        draft({ id: 'b', itemName: 'خيط', issuedBaseQty: 2, sourceType: 'DELIVERY_NOTE', sourceTypeLabel: 'إذن صرف' }),
      ],
      { page: 1, limit: 50, status: 'كامل', search: 'قماش' }
    );
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].itemName).toBe('قماش');
    expect(report.rows[0].status).toBe('مكتمل');
  });
});
