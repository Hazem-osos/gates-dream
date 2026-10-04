import {
  allowsOpeningDocumentDate,
  companyOpeningJournalWhere,
  isCompanyOpeningEntry,
  isOpeningBalanceDraft,
  openingJournalSlotKey,
} from '../../modules/accounting/services/opening-balance.service';

describe('company opening journal', () => {
  it('counts only the company opening entry, not inventory opening stock', () => {
    expect(isCompanyOpeningEntry({ entryType: 'OPENING_BALANCE', sourceType: null })).toBe(true);
    expect(isCompanyOpeningEntry({ entryType: 'OPENING_BALANCE' })).toBe(true);
    expect(isCompanyOpeningEntry({ entryType: 'OPENING_BALANCE', sourceType: 'OB' })).toBe(false);
    expect(isCompanyOpeningEntry({ entryType: 'OPENING_BALANCE', sourceType: 'OPEN' })).toBe(false);
    expect(isCompanyOpeningEntry({ entryType: 'OPENING_STOCK', sourceType: 'OB' })).toBe(false);
    expect(isCompanyOpeningEntry({ entryType: 'MANUAL' })).toBe(false);
  });

  it('filters the singleton to one company and ignores inventory sources', () => {
    expect(companyOpeningJournalWhere('company-1', 'keep-id')).toEqual({
      companyId: 'company-1',
      entryType: 'OPENING_BALANCE',
      OR: [{ sourceType: null }, { sourceType: { notIn: ['OB', 'OPEN'] } }],
      id: { not: 'keep-id' },
    });
  });

  it('allows an unbalanced draft only for the opening balance', () => {
    expect(isOpeningBalanceDraft({ saveAsDraft: true, entryType: 'OPENING_BALANCE' })).toBe(true);
    expect(isOpeningBalanceDraft({ saveAsDraft: true, entryType: 'MANUAL' })).toBe(false);
    expect(isOpeningBalanceDraft({ saveAsDraft: false, entryType: 'OPENING_BALANCE' })).toBe(false);
    expect(isOpeningBalanceDraft({ entryType: 'OPENING_BALANCE' })).toBe(false);
  });

  it('lets opening stock use the day before the fiscal year', () => {
    expect(allowsOpeningDocumentDate({ entryType: 'OPENING_STOCK', sourceType: 'OB' })).toBe(true);
    expect(allowsOpeningDocumentDate({ entryType: 'OPENING_BALANCE', sourceType: 'OB' })).toBe(true);
    expect(allowsOpeningDocumentDate({ entryType: 'MANUAL', sourceType: 'SALE' })).toBe(false);
  });

  it('reserves one active-source slot per company', () => {
    expect(openingJournalSlotKey('company-1')).toBe('company-1|OPENING_BALANCE');
  });
});
