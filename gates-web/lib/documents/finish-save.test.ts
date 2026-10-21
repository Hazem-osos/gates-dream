import { describe, expect, it, vi } from 'vitest';
import { toast } from '@/lib/feedback/toast';
import { DOCUMENT_UNPOSTED_LABEL } from '@/lib/documents/document-status-labels';
import { finishDocumentSave } from './finish-save';

vi.mock('@/lib/feedback/toast', () => ({
  toast: { success: vi.fn() },
}));

describe('finishDocumentSave', () => {
  it('clears for the next document after حفظ وترحيل', () => {
    const reset = vi.fn();
    const onOpen = vi.fn();
    finishDocumentSave({
      label: 'إذن',
      number: 'R-01',
      posted: true,
      savedId: 'abc',
      onOpen,
      reset,
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it('stays on saved unposted document after manual-post save', () => {
    const reset = vi.fn();
    const onOpen = vi.fn();
    finishDocumentSave({
      label: 'إذن',
      number: 'R-01',
      posted: false,
      savedId: 'abc',
      onOpen,
      reset,
    });
    expect(onOpen).toHaveBeenCalledWith('abc');
    expect(reset).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      'تم حفظ إذن',
      expect.objectContaining({
        description: `إذن رقم R-01 — ${DOCUMENT_UNPOSTED_LABEL}.`,
      })
    );
  });

  it('reopens saved document when cleared is false', () => {
    const reset = vi.fn();
    const onOpen = vi.fn();
    finishDocumentSave({
      label: 'إذن',
      number: 'R-01',
      savedId: 'abc',
      cleared: false,
      onOpen,
      reset,
    });
    expect(onOpen).toHaveBeenCalledWith('abc');
    expect(reset).not.toHaveBeenCalled();
  });

  it('clears when cleared is true', () => {
    const reset = vi.fn();
    const onOpen = vi.fn();
    finishDocumentSave({
      label: 'إذن',
      number: 'R-01',
      savedId: 'abc',
      cleared: true,
      onOpen,
      reset,
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });
});
