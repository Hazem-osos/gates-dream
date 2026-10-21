import { describe, expect, it } from 'vitest';
import { advancePercentOfContract, pricedBoqTotal, subcontractDeductionRows } from './contract-view';
import type { SubcontractBoqItem } from './types';

describe('pricedBoqTotal', () => {
  it('sums leaf BOQ lines and skips a parent header', () => {
    const items: SubcontractBoqItem[] = [
      {
        id: 'p',
        itemCode: '1',
        descriptionAr: 'فرع',
        unit: 'ITEM',
        contractQuantity: 1,
        unitPrice: 15148,
        totalPrice: 15148,
        maxAllowedQuantity: 1,
        cumulativeExecutedQty: 0,
      },
      {
        id: 'c',
        itemCode: '1.1',
        descriptionAr: 'خرسانة',
        unit: 'M3',
        contractQuantity: 422,
        unitPrice: 14,
        totalPrice: 5908,
        maxAllowedQuantity: 422,
        cumulativeExecutedQty: 0,
      },
    ];
    expect(pricedBoqTotal(items)).toBe(5908);
  });
});

describe('subcontractDeductionRows', () => {
  it('shows advance as a percent of contract value and recovery on the extract', () => {
    const rows = subcontractDeductionRows({
      totalContractValue: 15148,
      advancePaymentTotal: 3029.6,
      advancePaymentRecoveryRate: 0.2,
      retentionRate: 0.05,
      taxWithholdingRate: 0.01,
      socialInsuranceRate: 0,
      earlyPaymentDiscountRate: 0,
      contractAdminOverheadRate: 0,
    });
    const advance = rows.find((row) => row.name === 'دفعة مقدمة');
    expect(advancePercentOfContract({ totalContractValue: 15148, advancePaymentTotal: 3029.6 })).toBeCloseTo(20, 5);
    expect(advance?.contractValue).toBeCloseTo(3029.6);
    expect(advance?.extractPercent).toBeCloseTo(20);
    expect(advance?.onExtract).toBe(true);
    expect(advance?.affectsContractValue).toBe(false);
    expect(rows.find((row) => row.name === 'تأمين أعمال')?.extractPercent).toBeCloseTo(5);
  });
});
