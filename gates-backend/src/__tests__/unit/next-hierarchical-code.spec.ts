import { nextHierarchicalCode } from '../../shared/utils/next-numeric-code';

describe('nextHierarchicalCode', () => {
  it('starts roots at 1 then 2, 3 — not 00001', () => {
    expect(nextHierarchicalCode(null, [])).toBe('1');
    expect(nextHierarchicalCode(null, ['1'])).toBe('2');
    expect(nextHierarchicalCode(null, ['1', '2'])).toBe('3');
  });

  it('nests children like chart of accounts: 1 → 11 → 111', () => {
    expect(nextHierarchicalCode('1', [])).toBe('11');
    expect(nextHierarchicalCode('1', ['11'])).toBe('12');
    expect(nextHierarchicalCode('11', ['111'])).toBe('112');
  });

  it('strips padded parent codes so 00001 still yields 11', () => {
    expect(nextHierarchicalCode('00001', [])).toBe('11');
    expect(nextHierarchicalCode(null, ['00001'])).toBe('2');
  });
});
