import { journalSourceHref, journalSourceLabel } from './journal-source';

describe('journalSourceLabel', () => {
  it('uses the operations screen name for stock journals, not حركة مخزنية', () => {
    expect(journalSourceLabel('GI')).toBe('إذن صرف مخزني');
    expect(journalSourceLabel('GR')).toBe('إذن إضافة مخزني');
    expect(journalSourceLabel('TRF')).toBe('تحويل مخزني');
    expect(journalSourceLabel('STK')).toBe('الجرد');
    expect(journalSourceLabel('OADJ')).toBe('تسوية أخرى');
    expect(journalSourceLabel('ASM')).toBe('تجميع أصناف');
    expect(journalSourceLabel('DSM')).toBe('تفكيك أصناف');
    expect(journalSourceLabel('OB')).toBe('بضاعة أول المدة');
    expect(journalSourceLabel('GI-UNPOST', 'STOCK_TRANSACTION')).toBe('إذن صرف مخزني');
  });

  it('keeps invoice and cash voucher screen names', () => {
    expect(journalSourceLabel('SI')).toBe('فاتورة مبيعات');
    expect(journalSourceLabel('CP')).toBe('سند صرف');
    expect(journalSourceLabel('MANUAL')).toBe('قيد يدوي');
  });
});

describe('journalSourceHref', () => {
  it('opens securities papers on the live receipt/payment paths', () => {
    expect(journalSourceHref('SECURITIES_RECEIPT', 'p-1')).toBe(
      '/accounting/operations/securities/receipt?id=p-1'
    );
    expect(journalSourceHref('SECURITIES_PAYMENT', 'p-2')).toBe(
      '/accounting/operations/securities/payment?id=p-2'
    );
  });
});
