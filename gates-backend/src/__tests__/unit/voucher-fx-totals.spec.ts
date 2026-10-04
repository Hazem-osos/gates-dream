import {
  splitVoucherLineForeignTotals,
  splitVoucherLineTotals,
} from '../../modules/treasury/types/vouchers.dto';
import {
  cashOffsetInHeaderCurrency,
  postedCashFundAmount,
} from '../../modules/treasury/services/cash-fund-amount';
import { assertJournalBalanced } from '../../modules/accounting/services/auto-gl-balance';
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

  it('EGP header + USD lines posts cash in pounds so debitBase equals creditBase', () => {
    const netCashBase = splitVoucherLineTotals(usdReceipt, 'RECEIPT').netCash;
    expect(cashOffsetInHeaderCurrency(netCashBase, 1)).toBe(5000);
    expect(cashOffsetInHeaderCurrency(netCashBase, 1) * 1).toBe(netCashBase);
    expect(cashOffsetInHeaderCurrency(netCashBase, 50)).toBe(100);
  });

  it('EGP row plus USD row balance the cash journal in base currency', () => {
    const headerRate = 1;
    const party = [
      { debit: 0, credit: 2500, exchangeRate: 1, currencyCode: 'EGP' },
      { debit: 0, credit: 50, exchangeRate: 50, currencyCode: 'USD' },
    ];
    const netCashBase = party.reduce(
      (sum, line) => sum + line.credit * line.exchangeRate - line.debit * line.exchangeRate,
      0
    );
    const lines = [
      {
        debit: cashOffsetInHeaderCurrency(netCashBase, headerRate),
        credit: 0,
        exchangeRate: headerRate,
        currencyCode: 'EGP',
      },
      ...party,
    ];
    const hydrated = lines.map((line) => ({
      ...line,
      exchangeRate: persistJournalLineFxRate({
        headerCurrencyCode: 'EGP',
        lineCurrencyCode: line.currencyCode,
        lineRate: line.exchangeRate,
        headerRate,
      }),
    }));
    const totals = assertJournalBalanced(hydrated);
    expect(totals.totalDebit).toBe(5000);
    expect(totals.totalCredit).toBe(5000);
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
