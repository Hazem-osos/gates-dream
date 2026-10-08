import { describe, expect, it } from 'vitest';
import { dedupePersistedTabs, migrateTabHref } from '@/lib/navigation/tab-memory';

describe('tab-memory', () => {
  it('migrates legacy journal list path to journal entry screen', () => {
    expect(migrateTabHref('/accounting/journal-entries')).toBe(
      '/accounting/operations/journal-entry'
    );
    expect(migrateTabHref('/accounting/journal-entries?id=abc')).toBe(
      '/accounting/operations/journal-entry?id=abc'
    );
  });

  it('dedupes tabs that differ only by legacy alias', () => {
    const tabs = dedupePersistedTabs([
      {
        path: '/accounting/journal-entries',
        href: '/accounting/journal-entries',
        label: 'old',
      },
      {
        path: '/accounting/operations/journal-entry',
        href: '/accounting/operations/journal-entry?id=1',
        label: 'new',
      },
    ]);
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.path).toBe('/accounting/operations/journal-entry');
    expect(tabs[0]?.href).toContain('id=1');
  });
});
