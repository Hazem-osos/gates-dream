import { describe, expect, it, vi } from 'vitest';
import { syncOpenedDocumentMode } from './opened-document-mode';

const api = () => ({
  setMode: vi.fn(),
  lockToView: vi.fn(),
  unlockForEdit: vi.fn(),
});

describe('syncOpenedDocumentMode', () => {
  it('new screen stays in create', () => {
    const mode = api();
    syncOpenedDocumentMode(mode, { hasSavedId: false, hasPosting: true });
    expect(mode.setMode).toHaveBeenCalledWith('create');
    expect(mode.lockToView).not.toHaveBeenCalled();
  });

  it('saved card without posting opens in edit', () => {
    const mode = api();
    syncOpenedDocumentMode(mode, { hasSavedId: true, hasPosting: false });
    expect(mode.unlockForEdit).toHaveBeenCalled();
    expect(mode.lockToView).not.toHaveBeenCalled();
  });

  it('saved unposted voucher with posting opens in edit', () => {
    const mode = api();
    syncOpenedDocumentMode(mode, {
      hasSavedId: true,
      hasPosting: true,
      isPosted: false,
    });
    expect(mode.unlockForEdit).toHaveBeenCalled();
  });

  it('posted voucher stays locked until unpost', () => {
    const mode = api();
    syncOpenedDocumentMode(mode, {
      hasSavedId: true,
      hasPosting: true,
      isPosted: true,
    });
    expect(mode.lockToView).toHaveBeenCalled();
    expect(mode.unlockForEdit).not.toHaveBeenCalled();
  });

  it('cancelled document stays locked', () => {
    const mode = api();
    syncOpenedDocumentMode(mode, {
      hasSavedId: true,
      hasPosting: false,
      isCancelled: true,
    });
    expect(mode.lockToView).toHaveBeenCalled();
  });
});
