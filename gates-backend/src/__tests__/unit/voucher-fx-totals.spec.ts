import {
  splitVoucherLineForeignTotals,
  splitVoucherLineTotals,
} from '../../modules/treasury/types/vouchers.dto';
import { postedCashFundAmount } from '../../modules/treasury/services/cash-fund-amount';
import { persistJournalLineFxRate } from '../../modules/accounting/utils/company-fx-rate';

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

  it('unpost safe amount follows FX lines, not a stale header total', () => {
    expect(
      postedCashFundAmount({
        amount: 50000,
        exchangeRate: 50,
        transactionKind: 'RECEIPT',
        lines: [{ amount: 10000, exchangeRate: 50, entrySide: 'CREDIT' }],
      })
    ).toBe(500000);
    expect(
      postedCashFundAmount({
        amount: 50000,
        exchangeRate: 50,
        transactionKind: 'RECEIPT',
        lines: [{ amount: 50000, exchangeRate: 50, entrySide: 'CREDIT' }],
      })
    ).toBe(2500000);
    expect(
      postedCashFundAmount({
        amount: 10000,
        exchangeRate: 50,
        transactionKind: 'RECEIPT',
      })
    ).toBe(500000);
  });

  it('keeps a USD line rate when the journal header is EGP', () => {
    expect(
      persistJournalLineFxRate({
        headerCurrencyCode: 'EGP',
        lineRate: 50,
        headerRate: 1,
      })
    ).toBe(50);
    expect(
      persistJournalLineFxRate({
        headerCurrencyCode: 'EGP',
        lineCurrencyCode: 'EGP',
        lineRate: 1,
        headerRate: 1,
      })
    ).toBe(1);
  });
});
