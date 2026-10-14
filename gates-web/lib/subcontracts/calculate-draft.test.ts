import { describe, expect, it } from 'vitest';
import { calculateLiveDraft } from './calculate-draft';
import type { SubcontractDetail } from './types';

function subcontract(overrides: Partial<SubcontractDetail> = {}): SubcontractDetail {
  return {
    id: 'sc-1',
    subcontractNumber: 'SC-1',
    contractDate: '2026-01-01',
    totalContractValue: 303750,
    status: 'ACTIVE',
    advancePaymentTotal: 0,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
    maxAllowedVariationOrderRate: 0,
    standardScrapToleranceRate: 0,
    contractAdminOverheadRate: 0,
    earlyPaymentDiscountRate: 0,
    subcontractor: { id: 'ctr', nameAr: 'مقاول' },
    project: { id: 'proj', projectCode: 'P1', projectName: 'مشروع' },
    boqItems: [
      {
        id: 'p',
        itemCode: '1',
        descriptionAr: 'أعمال خرسانية',
        unit: 'ITEM',
        contractQuantity: 1,
        unitPrice: 303750,
        totalPrice: 303750,
        maxAllowedQuantity: 1,
        cumulativeExecutedQty: 0,
      },
      {
        id: 'c',
        itemCode: '1.1',
        descriptionAr: 'خرسانة',
        unit: 'M3',
        contractQuantity: 22.5,
        unitPrice: 13500,
        totalPrice: 303750,
        maxAllowedQuantity: 22.5,
        cumulativeExecutedQty: 0,
      },
    ],
    invoices: [],
    ...overrides,
  };
}

describe('calculateLiveDraft hierarchy', () => {
  it('excludes header BOQ rows from live lines and gross totals', () => {
    const live = calculateLiveDraft(subcontract(), { p: 1, c: 0.15 }, { applyEarlyPaymentDiscount: false });
    expect(live.lines.map((row) => row.subcontractBOQItemId)).toEqual(['c']);
    expect(live.grossCurrentAmount).toBe(2025);
  });

  it('keeps dashed lump-sum codes as independent executable lines', () => {
    const live = calculateLiveDraft(
      subcontract({
        totalContractValue: 200_000,
        boqItems: [
          {
            id: 'ls1',
            itemCode: 'P4-LS',
            descriptionAr: 'P4 Works',
            unit: 'LS',
            contractQuantity: 1,
            unitPrice: 100_000,
            totalPrice: 100_000,
            maxAllowedQuantity: 1,
            cumulativeExecutedQty: 0,
          },
          {
            id: 'ls2',
            itemCode: 'P4-LS-2',
            descriptionAr: 'P4 Works period 2',
            unit: 'LS',
            contractQuantity: 1,
            unitPrice: 100_000,
            totalPrice: 100_000,
            maxAllowedQuantity: 1,
            cumulativeExecutedQty: 0,
          },
        ],
      }),
      { ls1: 1, ls2: 1 },
      { applyEarlyPaymentDiscount: false }
    );
    expect(live.lines.map((row) => row.subcontractBOQItemId)).toEqual(['ls1', 'ls2']);
    expect(live.grossCurrentAmount).toBe(200_000);
  });
});
