import { describe, expect, it } from 'vitest';
import { resolveTenderCatalogPickerIds } from '@/lib/contracting/tender-catalog-picker';

const rows = [
  { id: 'season-1', parentId: null },
  { id: 'chapter-1', parentId: 'season-1' },
  { id: 'official-1', parentId: 'chapter-1' },
  { id: 'exec-1', parentId: 'official-1' },
  { id: 'official-2', parentId: 'chapter-1' },
  { id: 'season-2', parentId: null },
  { id: 'chapter-2', parentId: 'season-2' },
];

describe('resolveTenderCatalogPickerIds', () => {
  it('takes a first-level item with every descendant', () => {
    expect(resolveTenderCatalogPickerIds(rows, ['season-1'])).toEqual([
      'season-1',
      'chapter-1',
      'official-1',
      'exec-1',
      'official-2',
    ]);
  });

  it('takes only the checked node when it is not first-level', () => {
    expect(resolveTenderCatalogPickerIds(rows, ['chapter-1'])).toEqual(['chapter-1']);
    expect(resolveTenderCatalogPickerIds(rows, ['official-1'])).toEqual(['official-1']);
  });

  it('unions multiple checks without duplicating descendants', () => {
    expect(resolveTenderCatalogPickerIds(rows, ['season-1', 'chapter-1', 'season-2'])).toEqual([
      'season-1',
      'chapter-1',
      'official-1',
      'exec-1',
      'official-2',
      'season-2',
      'chapter-2',
    ]);
  });
});
