import { isDraftDocumentRow } from './deleteDraftDocument';

describe('isDraftDocumentRow', () => {
  it('treats unposted rows as drafts', () => {
    expect(isDraftDocumentRow({ isPosted: false })).toBe(true);
  });

  it('does not treat posted or cancelled rows as drafts', () => {
    expect(isDraftDocumentRow({ isPosted: true })).toBe(false);
    expect(isDraftDocumentRow({ isPosted: false, isCancelled: true })).toBe(false);
  });

  it('does not treat opening securities as drafts', () => {
    expect(isDraftDocumentRow({ isPosted: false, isOpening: true })).toBe(false);
    expect(isDraftDocumentRow({ isPosted: false, isOpening: false })).toBe(true);
  });
});
