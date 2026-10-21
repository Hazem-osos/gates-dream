import { describe, expect, it, beforeEach } from 'vitest';
import {
  readDraft,
  recordDraftDismissal,
  removeDraft,
  wasDraftDismissed,
  writeDraft,
} from './page-drafts';

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: memory, configurable: true });
}

describe('page draft dismissal', () => {
  const key = 'gates:draft:test:co:u:new';

  beforeEach(() => {
    installMemoryStorage();
  });

  it('keeps تجاهل so the same draft is not offered again', () => {
    writeDraft(key, { amount: '100' }, {
      companyId: 'co',
      documentType: 'test',
      mode: 'new',
      writeSeq: 1,
    });
    const saved = readDraft(key);
    expect(saved?.payload).toEqual({ amount: '100' });
    recordDraftDismissal(key, saved?.savedAt ?? '');
    removeDraft(key, { keepDismissal: true });
    expect(readDraft(key)).toBeNull();
    expect(wasDraftDismissed(key, saved?.savedAt ?? '')).toBe(true);
  });

  it('clears dismissal when a new draft is written after تجاهل', () => {
    recordDraftDismissal(key, '2026-01-01T00:00:00.000Z');
    writeDraft(key, { amount: '50' }, {
      companyId: 'co',
      documentType: 'test',
      mode: 'new',
      writeSeq: 1,
    });
    expect(wasDraftDismissed(key, '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});
