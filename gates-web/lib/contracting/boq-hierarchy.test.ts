import { describe, expect, it } from 'vitest';
import {
  compareItemCodes,
  isParentItemCode,
  itemCodeDepth,
  ownerBoqHierarchyHints,
  parentCodeFromItemCode,
  sumExecutable,
  withItemCodeHierarchy,
} from './boq-hierarchy';

describe('boq-hierarchy', () => {
  it('sorts dotted codes naturally', () => {
    const codes = ['10.1', '2', '1.2', '1', '1.10', '1.1'];
    expect([...codes].sort(compareItemCodes)).toEqual(['1', '1.1', '1.2', '1.10', '2', '10.1']);
  });

  it('detects parent vs executable children', () => {
    const rows = withItemCodeHierarchy(
      [
        { code: '1', qty: 0 },
        { code: '1.1', qty: 10 },
        { code: '1.2', qty: 5 },
        { code: '2', qty: 3 },
      ],
      (row) => row.code
    );
    expect(rows[0].__isParent).toBe(true);
    expect(rows[0].__depth).toBe(0);
    expect(rows[1].__isExecutable).toBe(true);
    expect(rows[1].__depth).toBe(1);
    expect(sumExecutable(rows, (row) => row.qty)).toBe(18);
  });

  it('does not treat unrelated codes as children', () => {
    expect(isParentItemCode('1', ['10', '2'])).toBe(false);
    expect(itemCodeDepth('A-1-2')).toBe(0);
    expect(itemCodeDepth('1.1')).toBe(1);
    expect([...['P4-LS-2', 'P4-LS', 'P4-LS-10']].sort(compareItemCodes)).toEqual([
      'P4-LS',
      'P4-LS-2',
      'P4-LS-10',
    ]);
  });

  it('does not infer parent/child from dash-separated lump-sum codes', () => {
    expect(parentCodeFromItemCode('P4-LS-2')).toBeNull();
    expect(parentCodeFromItemCode('1.1')).toBe('1');
    expect(isParentItemCode('P4-LS', ['P4-LS-2'])).toBe(false);
    expect(isParentItemCode('P4', ['P4-LS'])).toBe(false);
    expect(isParentItemCode('1', ['1.1'])).toBe(true);
    expect(isParentItemCode('1', ['10'])).toBe(false);
  });

  it('keeps P4-LS and P4-LS-2 as independent executable leaves in totals', () => {
    const rows = withItemCodeHierarchy(
      [
        {
          id: 'a',
          parentId: null,
          itemCode: 'P4-LS',
          isExecutable: true,
          hasChildren: false,
          isLeaf: true,
          totalSellingPrice: 100_000,
        },
        {
          id: 'b',
          parentId: null,
          itemCode: 'P4-LS-2',
          isExecutable: true,
          hasChildren: false,
          isLeaf: true,
          totalSellingPrice: 100_000,
        },
      ],
      (row) => row.itemCode,
      ownerBoqHierarchyHints
    );
    expect(rows.find((row) => row.itemCode === 'P4-LS')?.__isExecutable).toBe(true);
    expect(rows.find((row) => row.itemCode === 'P4-LS-2')?.__isExecutable).toBe(true);
    expect(rows.find((row) => row.itemCode === 'P4-LS')?.__depth).toBe(0);
    expect(rows.find((row) => row.itemCode === 'P4-LS-2')?.__depth).toBe(0);
    expect(sumExecutable(rows, (row) => row.totalSellingPrice)).toBe(200_000);
  });

  it('still treats dotted parents as headers when isExecutable defaults to true', () => {
    const rows = withItemCodeHierarchy(
      [
        { id: 'p', parentId: null, itemCode: '1', isExecutable: true },
        { id: 'c', parentId: null, itemCode: '1.1', isExecutable: true },
      ],
      (row) => row.itemCode,
      {
        id: (row) => row.id,
        parentId: (row) => row.parentId,
        isExecutable: (row) => row.isExecutable,
      }
    );
    expect(rows[0].__isParent).toBe(true);
    expect(rows[1].__isExecutable).toBe(true);
    expect(sumExecutable(rows, () => 1)).toBe(1);
  });

  it('prefers API parent/leaf flags over dotted-code inference', () => {
    const rows = withItemCodeHierarchy(
      [
        { id: 'p', parentId: null, itemCode: '1', isExecutable: false, hasChildren: true, isLeaf: false },
        { id: 'c', parentId: 'p', itemCode: '1.1', isExecutable: true, hasChildren: false, isLeaf: true },
      ],
      (row) => row.itemCode,
      {
        id: (row) => row.id,
        parentId: (row) => row.parentId,
        isLeaf: (row) => row.isLeaf,
        isExecutable: (row) => row.isExecutable,
        hasChildren: (row) => row.hasChildren,
      }
    );
    expect(rows[0].__isParent).toBe(true);
    expect(rows[1].__isExecutable).toBe(true);
    expect(sumExecutable(rows, () => 1)).toBe(1);
  });
});
