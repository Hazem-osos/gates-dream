import {
  assertAcyclicParent,
  inferParentIdFromCodes,
  isNonCertifiableHeader,
  leafItems,
  orphanChildIdsForParentCode,
  parentCodeFromItemCode,
  sumLeafLineAmounts,
} from '../../modules/contracting/utils/boq-hierarchy.util';
import { quantityTimesPrice } from '../../modules/contracting/services/extract-boq-calculation.util';

describe('BOQ / work-item hierarchy', () => {
  it('derives dotted parent codes from handwritten 1 / 1.1 style', () => {
    expect(parentCodeFromItemCode('1')).toBeNull();
    expect(parentCodeFromItemCode('1.1')).toBe('1');
    expect(parentCodeFromItemCode('1.1.2')).toBe('1.1');
  });

  it('treats parents with children as headers and aggregates leaf amounts only', () => {
    const items = [
      { id: 'p', parentId: null, itemCode: '1', quantity: 1, unitPrice: 303_750 },
      { id: 'c', parentId: 'p', itemCode: '1.1', quantity: 22.5, unitPrice: 13_500 },
    ];
    const leaves = leafItems(items);
    expect(leaves.map((row) => row.id)).toEqual(['c']);
    expect(sumLeafLineAmounts(items, quantityTimesPrice)).toBe(303_750);
  });

  it('does not double-count parent stored total plus children', () => {
    const items = [
      { id: 'p', parentId: null, quantity: 1, unitPrice: 10_000 },
      { id: 'c1', parentId: 'p', quantity: 2, unitPrice: 100 },
      { id: 'c2', parentId: 'p', quantity: 3, unitPrice: 100 },
    ];
    expect(sumLeafLineAmounts(items, quantityTimesPrice)).toBe(500);
  });

  it('rejects a parent cycle', () => {
    const items = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: null },
    ];
    expect(() => assertAcyclicParent(items, 'b', 'a')).toThrow('WORK_ITEM_PARENT_CYCLE');
  });

  it('rejects an item as its own parent', () => {
    expect(() => assertAcyclicParent([{ id: 'a', parentId: null }], 'a', 'a')).toThrow(
      'WORK_ITEM_PARENT_CYCLE'
    );
  });

  it('claims dotted children created before their parent code', () => {
    const items = [
      { id: 'c', parentId: null, itemCode: '1.1' },
      { id: 'p', parentId: null, itemCode: '1' },
    ];
    expect(orphanChildIdsForParentCode(items, '1', 'p')).toEqual(['c']);
  });

  it('infers parentId from existing dotted codes without creating a second ledger', () => {
    const inferred = inferParentIdFromCodes([
      { id: 'p', itemCode: '1' },
      { id: 'c', itemCode: '1.1' },
      { id: 'g', itemCode: '1.1.2' },
      { id: 'other', itemCode: '2' },
    ]);
    expect(inferred.get('c')).toBe('p');
    expect(inferred.get('g')).toBe('c');
    expect(inferred.has('p')).toBe(false);
    expect(inferred.has('other')).toBe(false);
  });

  it('does not infer Excel/create parent links from dashed lump-sum codes', () => {
    expect(parentCodeFromItemCode('P4-LS-2')).toBeNull();
    expect(parentCodeFromItemCode('1.1')).toBe('1');
    const inferred = inferParentIdFromCodes([
      { id: 'a', itemCode: 'P4-LS' },
      { id: 'b', itemCode: 'P4-LS-2' },
    ]);
    expect(inferred.size).toBe(0);
    const dotted = inferParentIdFromCodes([
      { id: 'p', itemCode: '1' },
      { id: 'c', itemCode: '1.1' },
      { id: 'ten', itemCode: '10' },
    ]);
    expect(dotted.get('c')).toBe('p');
    expect(dotted.has('ten')).toBe(false);
  });

  it('rejects dotted parent certification and keeps dashed LS siblings independently certifiable', () => {
    const dotted = [
      { id: 'p', parentId: null, itemCode: '1', isExecutable: true },
      { id: 'c', parentId: 'p', itemCode: '1.1', isExecutable: true },
    ];
    expect(isNonCertifiableHeader(dotted, 'p')).toBe(true);
    expect(isNonCertifiableHeader(dotted, 'c')).toBe(false);

    const dashed = [
      { id: 'a', parentId: null, itemCode: 'P4-LS', isExecutable: true },
      { id: 'b', parentId: null, itemCode: 'P4-LS-2', isExecutable: true },
    ];
    expect(isNonCertifiableHeader(dashed, 'a')).toBe(false);
    expect(isNonCertifiableHeader(dashed, 'b')).toBe(false);
    expect(sumLeafLineAmounts(
      dashed.map((row) => ({ ...row, quantity: 1, unitPrice: 100_000 })),
      quantityTimesPrice
    )).toBe(200_000);
  });
});
