import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES } from './labels';
import {
  buildLegacyExtractItemsFromWorkRows,
  buildLegacyExtractPayload,
  enterpriseDraftInvoiceItems,
  executableOwnerBoqItems,
  inferWorkItemParentId,
  mapExtractContractError,
  rateAnalysisSaveItems,
  resolveOwnerBoqCreatePayload,
  wave3ExtractSaveLines,
} from './mostakhlasat-contracts';
import type { OwnerBoqItem } from './types';

const parent: OwnerBoqItem = {
  id: 'p',
  projectId: 'proj',
  parentId: null,
  isExecutable: false,
  hasChildren: true,
  isLeaf: false,
  itemCode: '1',
  descriptionAr: 'أعمال خرسانية',
  unit: 'ITEM',
  contractQuantity: 1,
  directCostEstimated: 0,
  indirectMarkupRate: 0,
  unitSellingPrice: 303750,
  totalSellingPrice: 303750,
  cumulativeExecutedQty: 0,
  status: 'PRICED',
};

const child: OwnerBoqItem = {
  ...parent,
  id: 'c',
  parentId: 'p',
  isExecutable: true,
  hasChildren: false,
  isLeaf: true,
  itemCode: '1.1',
  descriptionAr: 'خرسانة',
  unit: 'M3',
  contractQuantity: 22.5,
  unitSellingPrice: 13500,
  totalSellingPrice: 303750,
};

describe('owner BOQ create payload', () => {
  it('sends parentId and notes on the existing technical-office create body', () => {
    const parsed = resolveOwnerBoqCreatePayload({
      parentCode: '1',
      itemCode: '1',
      descriptionAr: 'خرسانة',
      notes: 'ملاحظة بند',
      unit: 'M3',
      contractQuantity: 22.5,
      existingItems: [{ id: 'p', itemCode: '1' }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.itemCode).toBe('1.1');
    expect(parsed.parentId).toBe('p');
    expect(parsed.notes).toBe('ملاحظة بند');
  });

  it('infers parentId from a dotted code when the parent dropdown is empty', () => {
    const parsed = resolveOwnerBoqCreatePayload({
      parentCode: '',
      itemCode: '1.1',
      descriptionAr: 'خرسانة',
      unit: 'M3',
      contractQuantity: 1,
      existingItems: [{ id: 'p', itemCode: '1' }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parentId).toBe('p');
  });
});

describe('hierarchy and certificate payloads', () => {
  it('treats dotted parents as headers even when isExecutable still defaults to true', () => {
    const items: OwnerBoqItem[] = [
      { ...parent, isExecutable: true, hasChildren: undefined, isLeaf: undefined, parentId: null },
      { ...child, parentId: null },
    ];
    const leaves = executableOwnerBoqItems(items);
    expect(leaves.map((row) => row.id)).toEqual(['c']);
  });

  it('does not infer a parent from dashed lump-sum codes', () => {
    const parsed = resolveOwnerBoqCreatePayload({
      parentCode: '',
      itemCode: 'P4-LS-2',
      descriptionAr: 'P4 Works period 2',
      unit: 'LS',
      contractQuantity: 1,
      existingItems: [{ id: 'p', itemCode: 'P4-LS' }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parentId).toBeUndefined();
  });

  it('keeps P4-LS and P4-LS-2 in enterprise draft items and selling totals', () => {
    const ls1: OwnerBoqItem = {
      ...child,
      id: 'ls1',
      parentId: null,
      isExecutable: true,
      hasChildren: false,
      isLeaf: true,
      itemCode: 'P4-LS',
      unit: 'LS',
      contractQuantity: 1,
      unitSellingPrice: 100_000,
      totalSellingPrice: 100_000,
    };
    const ls2: OwnerBoqItem = { ...ls1, id: 'ls2', itemCode: 'P4-LS-2' };
    expect(executableOwnerBoqItems([ls1, ls2]).map((row) => row.id)).toEqual(['ls1', 'ls2']);
    const items = enterpriseDraftInvoiceItems([ls1, ls2], [
      { projectBOQItemId: 'ls1', currentQuantity: 1 },
      { projectBOQItemId: 'ls2', currentQuantity: 1 },
    ]);
    expect(items).toEqual([
      { projectBOQItemId: 'ls1', currentQuantity: 1 },
      { projectBOQItemId: 'ls2', currentQuantity: 1 },
    ]);
  });

  it('excludes header rows from enterprise draft items and sends currentQuantity only', () => {
    const items = enterpriseDraftInvoiceItems([parent, child], [
      { projectBOQItemId: 'p', currentQuantity: 1 },
      { projectBOQItemId: 'c', currentQuantity: 0.15 },
    ]);
    expect(items).toEqual([{ projectBOQItemId: 'c', currentQuantity: 0.15 }]);
    expect(items[0]).not.toHaveProperty('previousQuantity');
  });

  it('Wave3 save lines send currentQuantity only and drop header rows', () => {
    const lines = wave3ExtractSaveLines([
      { boqItemId: 'p', itemNumber: '1', currentQuantity: 1 },
      { boqItemId: 'c', itemNumber: '1.1', currentQuantity: 5 },
    ]);
    expect(lines).toEqual([{ boqItemId: 'c', currentQuantity: 5 }]);
  });
});

describe('legacy extract preview/create body', () => {
  it('uses the same payload shape for preview and create', () => {
    const payload = buildLegacyExtractPayload({
      projectId: 'proj-1',
      contractorId: 'ctr-1',
      extractNumber: 'EX-9',
      extractDate: '2026-10-14T00:00:00.000Z',
      items: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 0.15, unitPrice: 13500 }],
    });
    expect(payload).toEqual({
      projectId: 'proj-1',
      contractorId: 'ctr-1',
      extractNumber: 'EX-9',
      extractDate: '2026-10-14T00:00:00.000Z',
      extractType: 'contractor',
      items: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 0.15, unitPrice: 13500 }],
    });
  });

  it('drops header work-item rows from the shared preview/create items', () => {
    const items = buildLegacyExtractItemsFromWorkRows(
      [
        { id: 'p', arabicName: 'رئيسي', itemNumber: '1', __isExecutable: false },
        { id: 'c', arabicName: 'خرسانة', itemNumber: '1.1', unitPrice: 13500, __isExecutable: true },
      ],
      { p: 1, c: 0.15 }
    );
    expect(items).toEqual([
      { workItemId: 'c', itemName: 'خرسانة', itemNumber: '1.1', quantity: 0.15, unit: undefined, unitPrice: 13500 },
    ]);
  });

  it('maps 409 duplicate-number and 422 header/over-qty errors', () => {
    expect(mapExtractContractError({ code: '409', message: 'Extract number EX-1 already exists' }).status).toBe(409);
    expect(mapExtractContractError({ code: '422', message: 'EXTRACT_HEADER_NOT_CERTIFIABLE:1' }).message).toMatch(
      /بند رئيسي/
    );
    expect(mapExtractContractError({ code: '422', message: 'Work item 1.1 cumulative quantity exceeds BOQ' }).message).toMatch(
      /exceeds/
    );
  });
});

describe('rate analysis payload', () => {
  it('keeps supported cost elements and waste as a 0–1 rate — no SERVICE', () => {
    expect(ELEMENT_TYPES).not.toContain('SERVICE');
    const items = rateAnalysisSaveItems([
      {
        costElementType: 'MATERIAL',
        consumptionQuotaPerUnit: 0.15,
        unitCost: 13500,
        wasteFactorRate: 0,
      },
      {
        costElementType: 'SERVICE' as never,
        consumptionQuotaPerUnit: 1,
        unitCost: 10,
        wasteFactorRate: 0,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].previewTotal).toBe(2025);
    expect(items[0].wasteFactorRate).toBe(0);
  });
});

describe('work-item parent inference', () => {
  it('links 1.1 to existing item 1', () => {
    expect(inferWorkItemParentId('1.1', [{ id: 'p', itemNumber: '1' }])).toBe('p');
    expect(inferWorkItemParentId('1', [{ id: 'p', itemNumber: '1' }])).toBeUndefined();
  });
});
