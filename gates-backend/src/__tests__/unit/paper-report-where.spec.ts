import {
  openingPaperStatus,
  paperReportAccountName,
  paperSideWheres,
} from '../../modules/accounting/utils/paper-report-where';

describe('paperSideWheres', () => {
  it('includes unposted opening receipts and keeps payments posted-only', () => {
    const { receiptWhere, paymentWhere } = paperSideWheres({
      companyId: 'c1',
      isCancelled: false,
      isPosted: true,
    });

    expect(receiptWhere).toMatchObject({
      companyId: 'c1',
      isCancelled: false,
      OR: [{ isPosted: true }, { isOpening: true }],
    });
    expect(receiptWhere.isPosted).toBeUndefined();
    expect(paymentWhere).toMatchObject({
      companyId: 'c1',
      isCancelled: false,
      isPosted: true,
    });
  });

  it('nests account filters without dropping the opening receipt clause', () => {
    const { receiptWhere, paymentWhere } = paperSideWheres(
      { companyId: 'c1', isPosted: true, isCancelled: false },
      ['acc-1']
    );

    expect(receiptWhere.OR).toEqual([{ isPosted: true }, { isOpening: true }]);
    expect(receiptWhere.AND).toEqual([
      {
        OR: [{ destinationAccountId: { in: ['acc-1'] } }, { depositAccountId: { in: ['acc-1'] } }],
      },
    ]);
    expect(paymentWhere).toMatchObject({
      isPosted: true,
      destinationAccountId: { in: ['acc-1'] },
    });
  });

  it('drops posted-only filters when reading unposted journals', () => {
    const { receiptWhere, paymentWhere } = paperSideWheres(
      { companyId: 'c1', isCancelled: false, isPosted: true },
      undefined,
      true
    );
    expect(receiptWhere.OR).toBeUndefined();
    expect(receiptWhere.isPosted).toBeUndefined();
    expect(paymentWhere.isPosted).toBeUndefined();
  });
});

describe('paperReportAccountName', () => {
  it('prefers the cheque party account then notes account', () => {
    expect(
      paperReportAccountName({
        partyAccount: { code: '1201', arabicName: 'عملاء' },
        notesAccount: { code: '1103', arabicName: 'أوراق قبض' },
        partyName: 'عميل النور',
      })
    ).toBe('[1201] عملاء');
    expect(
      paperReportAccountName({
        notesAccount: { code: '1103', arabicName: 'أوراق قبض' },
        partyName: 'عميل النور',
      })
    ).toBe('[1103] أوراق قبض');
  });
});

describe('openingPaperStatus', () => {
  it('labels opening papers even after they are saved posted', () => {
    expect(openingPaperStatus(true, false)).toBe('افتتاحية');
    expect(openingPaperStatus(true, true)).toBe('افتتاحية');
    expect(openingPaperStatus(false, false)).toBeNull();
  });
});
