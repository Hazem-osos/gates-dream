import { JournalSourceType } from '@prisma/client';
import { persistJournalSourceType, resolveJournalSourceKind } from '../../modules/accounting/utils/journal-source';

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
});
