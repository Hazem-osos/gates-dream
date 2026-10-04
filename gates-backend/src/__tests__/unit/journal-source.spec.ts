import { JournalSourceType } from '@prisma/client';
import {
  isSourcedJournalEntry,
  persistJournalSourceType,
  resolveJournalSourceKind,
} from '../../modules/accounting/utils/journal-source';

describe('journal source mapping', () => {
  it('maps securities papers to their own source kinds, not MANUAL', () => {
    expect(resolveJournalSourceKind('SECR')).toBe(JournalSourceType.SECURITIES_RECEIPT);
    expect(resolveJournalSourceKind('SECP')).toBe(JournalSourceType.SECURITIES_PAYMENT);
    expect(resolveJournalSourceKind('SECREN')).toBe(JournalSourceType.SECURITIES_RECEIPT);
  });

  it('prefers the short paper code over a leftover MANUAL kind', () => {
    expect(resolveJournalSourceKind('SECR', JournalSourceType.MANUAL)).toBe(
      JournalSourceType.SECURITIES_RECEIPT
    );
    expect(resolveJournalSourceKind('SECP', JournalSourceType.MANUAL)).toBe(
      JournalSourceType.SECURITIES_PAYMENT
    );
  });

  it('persists the short Auto-GL codes for securities papers', () => {
    expect(persistJournalSourceType('SECR')).toBe('SECR');
    expect(persistJournalSourceType('SECP')).toBe('SECP');
  });

  it('does not treat a cyclic daily voucher as a sourced document', () => {
    expect(
      isSourcedJournalEntry({
        sourceType: 'MANUAL',
        sourceKind: JournalSourceType.MANUAL,
        sourceId: 'template-1',
        entryType: 'MANUAL',
        isCyclic: true,
      })
    ).toBe(false);
  });

  it('keeps stock-transfer source codes so unpost can find the journal', () => {
    expect(persistJournalSourceType('TRF')).toBe('TRF');
    expect(persistJournalSourceType('GI')).toBe('GI');
    expect(persistJournalSourceType('POS')).toBe('POS');
    expect(persistJournalSourceType('POS-VOID')).toBe('POS-VOID');
    expect(persistJournalSourceType('POS-DEPOSIT')).toBe('POS-DEPOSIT');
    expect(persistJournalSourceType('POS-GIFT')).toBe('POS-GIFT');
    expect(persistJournalSourceType('POS-POINTS')).toBe('POS-POINTS');
  });
});
