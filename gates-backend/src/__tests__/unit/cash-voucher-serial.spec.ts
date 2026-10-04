import {
  cashTreasuryFamily,
  cashVoucherDocType,
  cashVoucherFamily,
  cashVoucherFund,
} from '../../modules/treasury/services/cash-transaction.service';

describe('cash voucher serial families', () => {
  it('gives each of the four voucher types its own sequence', () => {
    expect(cashVoucherFamily({ transactionKind: 'PAYMENT' })).toBe('BP01');
    expect(cashVoucherDocType({ transactionKind: 'PAYMENT' })).toBe('CASH-BP01');
    expect(cashVoucherFund(null)).toBe('CASH');

    expect(cashVoucherFamily({ transactionKind: 'RECEIPT' })).toBe('BR01');
    expect(cashVoucherDocType({ transactionKind: 'RECEIPT' })).toBe('CASH-BR01');

    expect(cashVoucherFamily({ transactionKind: 'PAYMENT', bankAccountId: 'bank-1' })).toBe('KP01');
    expect(cashVoucherDocType({ transactionKind: 'PAYMENT', bankAccountId: 'bank-1' })).toBe('CASH-KP01');
    expect(cashVoucherFund('bank-1')).toBe('BANK');

    expect(cashVoucherFamily({ transactionKind: 'RECEIPT', bankAccountId: 'bank-1' })).toBe('KR01');
    expect(cashVoucherDocType({ transactionKind: 'RECEIPT', bankAccountId: 'bank-1' })).toBe('CASH-KR01');
  });

  it('gives cash payment orders and cash receipt orders their own sequences', () => {
    expect(cashVoucherDocType({ transactionKind: 'PAYMENT', documentRole: 'ORDER' })).toBe('CASH-ORDER-BP01');
    expect(cashVoucherDocType({ transactionKind: 'RECEIPT', documentRole: 'ORDER' })).toBe('CASH-ORDER-BR01');
    expect(cashTreasuryFamily({ transactionKind: 'PAYMENT', documentRole: 'ORDER' })).toBe('ORDP');
    expect(cashTreasuryFamily({ transactionKind: 'RECEIPT', documentRole: 'ORDER' })).toBe('ORDR');
    expect(cashTreasuryFamily({ transactionKind: 'PAYMENT', documentRole: 'VOUCHER' })).toBe('BP01');
    expect(cashTreasuryFamily({ transactionKind: 'RECEIPT', documentRole: 'VOUCHER' })).toBe('BR01');
    expect(
      cashTreasuryFamily({ transactionKind: 'PAYMENT', documentRole: 'VOUCHER', bankAccountId: 'bank-1' })
    ).toBe('KP01');
    expect(
      cashTreasuryFamily({ transactionKind: 'RECEIPT', documentRole: 'VOUCHER', bankAccountId: 'bank-1' })
    ).toBe('KR01');
  });
});
