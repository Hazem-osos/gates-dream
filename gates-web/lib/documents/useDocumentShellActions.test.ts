import { describe, expect, it } from 'vitest';
import { resolveDocumentActionPolicy } from '@/lib/documents/document-action-policy';

describe('useDocumentShellActions policy wiring', () => {
  it('posted phase disables edit and void', () => {
    const policy = resolveDocumentActionPolicy({
      documentId: 'x',
      isPosted: true,
      isCancelled: false,
    });
    expect(policy.edit.enabled).toBe(false);
    expect(policy.unpost.enabled).toBe(true);
    expect(policy.void.enabled).toBe(false);
  });
});
