import { describe, expect, it } from 'vitest';
import { pickBrowseCodeColumnId } from '@/lib/browse/browse-list-sort';

describe('pickBrowseCodeColumnId', () => {
  it('prefers code-like column ids over date', () => {
    expect(pickBrowseCodeColumnId(['date', 'num', 'desc'], ['التاريخ', 'المسلسل', 'الشرح'])).toBe(
      'num'
    );
  });

  it('falls back to header label', () => {
    expect(pickBrowseCodeColumnId(['when', 'doc'], ['التاريخ', 'الكود'])).toBe('doc');
  });
});
