import {
  DOCUMENT_CANCELLED_LABEL,
  DOCUMENT_POSTED_LABEL,
  DOCUMENT_UNPOSTED_LABEL,
  DOCUMENT_UNSAVED_LABEL,
  resolveDocumentLifecycleStatus,
  resolveErpDocumentHeaderBadge,
} from '@/lib/documents/document-status-labels';

describe('resolveDocumentLifecycleStatus', () => {
  it('unsaved document before first save is جديد, never مسودة', () => {
    const s = resolveDocumentLifecycleStatus({ documentId: null, isPosted: false });
    expect(s.label).toBe(DOCUMENT_UNSAVED_LABEL);
    expect(s.label).toBe('جديد');
    expect(s.tone).toBe('neutral');
    expect(s.phase).toBe('unsaved');
  });

  it('saved but not posted when auto-post is off', () => {
    const s = resolveDocumentLifecycleStatus({
      documentId: 'abc',
      isPosted: false,
    });
    expect(s.label).toBe(DOCUMENT_UNPOSTED_LABEL);
    expect(s.phase).toBe('unposted');
  });

  it('posted', () => {
    const s = resolveDocumentLifecycleStatus({ documentId: 'abc', isPosted: true });
    expect(s.label).toBe(DOCUMENT_POSTED_LABEL);
    expect(s.phase).toBe('posted');
  });

  it('unpost returns to unposted', () => {
    const s = resolveDocumentLifecycleStatus({ documentId: 'abc', isPosted: false });
    expect(s.label).toBe(DOCUMENT_UNPOSTED_LABEL);
    expect(s.label).not.toMatch(/مسودة/);
  });

  it('cancelled wins over posted flag', () => {
    const s = resolveDocumentLifecycleStatus({
      documentId: 'abc',
      isPosted: true,
      isCancelled: true,
    });
    expect(s.label).toBe(DOCUMENT_CANCELLED_LABEL);
    expect(s.phase).toBe('cancelled');
  });
});

describe('resolveErpDocumentHeaderBadge', () => {
  it('replaces legacy مسودة with غير مرحّل when saved', () => {
    const b = resolveErpDocumentHeaderBadge(
      { documentId: 'id-1', isPosted: false },
      'مسودة'
    );
    expect(b.label).toBe(DOCUMENT_UNPOSTED_LABEL);
    expect(b.tone).toBe('warning');
  });

  it('keeps approval override on saved unposted doc', () => {
    const b = resolveErpDocumentHeaderBadge(
      { documentId: 'id-1', isPosted: false },
      'معتمدة',
      'info'
    );
    expect(b.label).toBe('معتمدة');
    expect(b.tone).toBe('info');
  });
});
