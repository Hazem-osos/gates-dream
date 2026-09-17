import {
  duplicateAccountNameMessage,
  normalizeAccountName,
  partyAccountTakenMessage,
} from '../../modules/accounting/utils/account-name-uniqueness';

describe('account-name-uniqueness helpers', () => {
  it('collapses spaces in account names', () => {
    expect(normalizeAccountName('  أحمد   محمد  ')).toBe('أحمد محمد');
  });

  it('names the colliding account in the Arabic error', () => {
    expect(duplicateAccountNameMessage('أحمد', '1121001')).toContain('1121001');
    expect(duplicateAccountNameMessage('أحمد', '1121001')).toContain('أحمد');
  });

  it('names the other party that already owns the account', () => {
    const customer = partyAccountTakenMessage('CUSTOMER', 'شركة النور', '12');
    expect(customer).toContain('شركة النور');
    expect(customer).toContain('12');
    expect(customer).toContain('عميل');

    const supplier = partyAccountTakenMessage('SUPPLIER', 'مورد الحديد');
    expect(supplier).toContain('مورد الحديد');
    expect(supplier).toContain('مورد');
  });
});
