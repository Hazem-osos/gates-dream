import { describe, expect, it } from 'vitest';
import { resolveLinkedJournalId } from './linked-journal-preview';

const je = '11111111-1111-4111-8111-111111111111';
const src = '22222222-2222-4222-8222-222222222222';

describe('resolveLinkedJournalId', () => {
  it('prefers the document journalEntryId', () => {
    expect(resolveLinkedJournalId(je, [{ id: src }])).toBe(je);
  });

  it('falls back to the source journal when the document link is missing', () => {
    expect(resolveLinkedJournalId(null, [{ id: src }])).toBe(src);
  });

  it('ignores non-uuid ids', () => {
    expect(resolveLinkedJournalId('TRF-1', [{ id: 'not-a-uuid' }])).toBeNull();
  });
});
