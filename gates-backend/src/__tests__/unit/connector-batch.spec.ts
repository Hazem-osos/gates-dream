import {
  clampBatchLimit,
  resolveDefaultOrderColumn,
  sanitizeSqlIdentifier,
} from '../../modules/migration-engine/legacy-source/connector-batch';

describe('connector-batch', () => {
  it('clamps batch limits', () => {
    expect(clampBatchLimit(0)).toBe(1);
    expect(clampBatchLimit(99999)).toBe(5000);
  });

  it('resolves known order columns', () => {
    expect(resolveDefaultOrderColumn('Branch')).toBe('BranchCode');
    expect(resolveDefaultOrderColumn('UnknownTable')).toBeNull();
  });

  it('sanitizes identifiers', () => {
    expect(sanitizeSqlIdentifier('GLTrxHeader')).toBe('GLTrxHeader');
    expect(() => sanitizeSqlIdentifier('')).toThrow();
  });
});
