import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { deleteDraftDocument, isDraftDocumentRow } from './deleteDraftDocument';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedDelete = vi.mocked(apiClient.delete);
const mockedPost = vi.mocked(apiClient.post);

describe('deleteDraftDocument', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
    mockedPost.mockReset();
  });

  it('uses DELETE for permanent draft removal', async () => {
    mockedDelete.mockResolvedValue({ status: 'success' });
    await deleteDraftDocument('/invoices', 'inv-1');
    expect(mockedDelete).toHaveBeenCalledWith('/invoices/inv-1');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('falls back to cancel only when DELETE route is missing', async () => {
    mockedDelete.mockRejectedValue(Object.assign(new Error('Not found'), { code: '404' }));
    mockedPost.mockResolvedValue({ status: 'success' });
    await deleteDraftDocument('/inventory/assemblies', 'asm-1');
    expect(mockedPost).toHaveBeenCalledWith('/inventory/assemblies/asm-1/cancel', {});
  });
});

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
