import { describe, expect, it } from 'vitest';
import { savedInvoiceHydrateKey } from './invoice-form-hydrate';

describe('savedInvoiceHydrateKey', () => {
  it('stays the same when only the screen date would change', () => {
    const before = savedInvoiceHydrateKey({ id: 'ret-1', version: 3, isPosted: false });
    const afterEdit = savedInvoiceHydrateKey({ id: 'ret-1', version: 3, isPosted: false });
    expect(before).toBe(afterEdit);
    expect(before).toBe('ret-1:3:0');
  });

  it('changes after save/post so the form can reload the persisted date', () => {
    expect(savedInvoiceHydrateKey({ id: 'ret-1', version: 3, isPosted: false })).toBe(
      'ret-1:3:0'
    );
    expect(savedInvoiceHydrateKey({ id: 'ret-1', version: 4, isPosted: false })).toBe(
      'ret-1:4:0'
    );
    expect(savedInvoiceHydrateKey({ id: 'ret-1', version: 4, isPosted: true })).toBe(
      'ret-1:4:1'
    );
  });

  it('is empty until a saved document is open', () => {
    expect(savedInvoiceHydrateKey(null)).toBeNull();
    expect(savedInvoiceHydrateKey({ id: '', version: 1 })).toBeNull();
  });
});
