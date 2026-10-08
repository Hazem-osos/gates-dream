import { describe, expect, it, vi } from 'vitest';
import { finishDocumentSave } from './finish-save';

vi.mock('@/lib/feedback/toast', () => ({
  toast: { success: vi.fn() },
}));

describe('finishDocumentSave', () => {
  it('clears for the next document by default', () => {
    const reset = vi.fn();
    const onOpen = vi.fn();
    finishDocumentSave({
      label: 'إذن',
      number: 'R-01',
      savedId: 'abc',
      onOpen,
      reset,
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
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
