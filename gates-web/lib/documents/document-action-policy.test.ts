import { resolveDocumentActionPolicy } from '@/lib/documents/document-action-policy';

const enabledActions = (input: Parameters<typeof resolveDocumentActionPolicy>[0]) => {
  const { phase: _phase, ...actions } = resolveDocumentActionPolicy(input);
  return Object.entries(actions)
    .filter(([, state]) => state.enabled)
    .map(([id]) => id)
    .sort();
};

describe('resolveDocumentActionPolicy', () => {
  it('unsaved: only new and save', () => {
    expect(enabledActions({ documentId: null })).toEqual(['new', 'save']);
  });

  it('saved but not posted: everything except unpost and restore', () => {
    expect(enabledActions({ documentId: 'a', isPosted: false })).toEqual(
      ['edit', 'new', 'post', 'save', 'void'].sort()
    );
  });

  it('posted: only new and unpost', () => {
    expect(enabledActions({ documentId: 'a', isPosted: true })).toEqual(['new', 'unpost']);
  });

  it('cancelled: only new and restore, even if the posted flag is stale', () => {
    expect(enabledActions({ documentId: 'a', isPosted: true, isCancelled: true })).toEqual([
      'new',
      'restore',
    ]);
  });

  it('opening documents keep edit after cancel', () => {
    const policy = resolveDocumentActionPolicy(
      { documentId: 'a', isCancelled: true },
      { allowEditWhenCancelled: true }
    );
    expect(policy.edit.enabled).toBe(true);
    expect(policy.post.enabled).toBe(false);
  });
});
