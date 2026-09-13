import { applyFullTextIds, toBooleanModeQuery } from '../../shared/database/fulltext-search';

describe('fulltext-search', () => {
  describe('toBooleanModeQuery', () => {
    it('returns null for blank input', () => {
      expect(toBooleanModeQuery('')).toBeNull();
      expect(toBooleanModeQuery('   ')).toBeNull();
      expect(toBooleanModeQuery('+++')).toBeNull();
    });

    it('appends * for prefix matching and strips BOOLEAN operators', () => {
      expect(toBooleanModeQuery('INV-100')).toBe('INV-100*');
      expect(toBooleanModeQuery('+foo -bar')).toBe('foo* bar*');
      expect(toBooleanModeQuery('أحمد محمد')).toBe('أحمد* محمد*');
    });

    it('caps token count', () => {
      const q = toBooleanModeQuery('a b c d e f g h i j');
      expect(q?.split(' ')).toHaveLength(8);
    });
  });

  describe('applyFullTextIds', () => {
    it('leaves the where clause unchanged when search is skipped', () => {
      const where = { companyId: 'co-1' };
      expect(applyFullTextIds(where, null)).toBe(where);
      expect(where).toEqual({ companyId: 'co-1' });
    });

    it('signals an empty result set when MATCH returns no rows', () => {
      expect(applyFullTextIds({ companyId: 'co-1' }, [])).toBe('empty');
    });

    it('restricts ids while keeping companyId', () => {
      const where: Record<string, unknown> = { companyId: 'co-1' };
      applyFullTextIds(where, ['a', 'b']);
      expect(where).toEqual({ companyId: 'co-1', id: { in: ['a', 'b'] } });
    });
  });
});
