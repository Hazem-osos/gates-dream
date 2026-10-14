import { describe, expect, it } from 'vitest';
import { computeLiveClientBreakdown } from './client-invoice-math';
import type { ClientContractDetail, OwnerBoqItem } from './types';

const parent: OwnerBoqItem = {
  id: 'p',
  projectId: 'proj',
  parentId: null,
  isExecutable: true,
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
  parentId: null,
  itemCode: '1.1',
  descriptionAr: 'خرسانة',
  unit: 'M3',
  contractQuantity: 22.5,
  unitSellingPrice: 13500,
  totalSellingPrice: 303750,
};

const contract: ClientContractDetail = {
  id: 'ctr',
  projectId: 'proj',
  contractNumber: 'C-1',
  clientCustomerId: 'cust',
  contractDate: '2026-01-01',
  totalContractValue: 303750,
  advancePaymentAmount: 0,
  advanceRecoveryRate: 0,
  retentionRate: 0,
  engineeringStampsRate: 0,
  status: 'ACTIVE',
  invoices: [],
};

describe('computeLiveClientBreakdown', () => {
  it('does not double-count dotted parent rows when isExecutable still defaults true', () => {
    const live = computeLiveClientBreakdown({
      contract,
      boqItems: [parent, child],
      lines: [
        { projectBOQItemId: 'p', currentQuantity: 1 },
        { projectBOQItemId: 'c', currentQuantity: 0.15 },
      ],
      siteStock: [],
      claimIds: [],
      installIds: [],
      otherClientPenalties: 0,
    });
    expect(live.grossCurrentWorks).toBe(2025);
  });

  it('includes both P4-LS lump-sum items in live works totals', () => {
    const p4Ls: OwnerBoqItem = {
      ...parent,
      id: 'ls1',
      itemCode: 'P4-LS',
      unit: 'LS',
      contractQuantity: 1,
      unitSellingPrice: 100_000,
      totalSellingPrice: 100_000,
      isExecutable: true,
      hasChildren: false,
      isLeaf: true,
    };
    const p4Ls2: OwnerBoqItem = {
      ...p4Ls,
      id: 'ls2',
      itemCode: 'P4-LS-2',
    };
    const live = computeLiveClientBreakdown({
      contract,
      boqItems: [p4Ls, p4Ls2],
      lines: [
        { projectBOQItemId: 'ls1', currentQuantity: 1 },
        { projectBOQItemId: 'ls2', currentQuantity: 1 },
      ],
      siteStock: [],
      claimIds: [],
      installIds: [],
      otherClientPenalties: 0,
    });
    expect(live.grossCurrentWorks).toBe(200_000);
  });
});
