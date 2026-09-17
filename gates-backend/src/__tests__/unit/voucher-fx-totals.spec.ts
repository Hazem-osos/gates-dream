import {
  splitVoucherLineForeignTotals,
  splitVoucherLineTotals,
} from '../../modules/treasury/types/vouchers.dto';

describe('voucher FX totals', () => {
  const usdReceipt = [
    { amount: 100, exchangeRate: 50, entrySide: 'CREDIT' as const },
  ];

  it('base net is amount × rate; foreign net stays in document currency', () => {
    expect(splitVoucherLineTotals(usdReceipt, 'RECEIPT').netCash).toBe(5000);
    expect(splitVoucherLineForeignTotals(usdReceipt, 'RECEIPT').netCash).toBe(100);
  });

  it('payment foreign net ignores rate', () => {
    const lines = [
      { amount: 80, exchangeRate: 50, entrySide: 'DEBIT' as const },
      { amount: 10, exchangeRate: 50, entrySide: 'CREDIT' as const },
    ];
    expect(splitVoucherLineForeignTotals(lines, 'PAYMENT').netCash).toBe(70);
    expect(splitVoucherLineTotals(lines, 'PAYMENT').netCash).toBe(3500);
  });
});
