import { journalReversalDescription } from '../../modules/accounting/constants/ledger-integrity';
import { PERIOD_LOCKED_MESSAGE } from '../../modules/accounting/constants/ledger-integrity';
import { VAT_ACCOUNT_UNMAPPED_MESSAGE } from '../../modules/accounting/constants/ledger-integrity';

describe('ledger integrity messages', () => {
  it('formats Arabic contra descriptions', () => {
    expect(journalReversalDescription('00000042', 'فك ترحيل')).toBe(
      'قيد عكسي للقيد رقم 00000042 - فك ترحيل'
    );
    expect(journalReversalDescription('JE-1')).toBe('قيد عكسي للقيد رقم JE-1');
  });

  it('exports the locked-period and unmapped-VAT messages', () => {
    expect(PERIOD_LOCKED_MESSAGE).toMatch(/مقفلة/);
    expect(VAT_ACCOUNT_UNMAPPED_MESSAGE).toMatch(/الضريبة/);
  });
});
