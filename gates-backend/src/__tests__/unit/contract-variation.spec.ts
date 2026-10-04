import { Decimal } from '@prisma/client/runtime/library';
import {
  resolveEffectiveOwnerBoqQuantityFromBase,
  resolveEffectiveOwnerBoqRateFromLines,
  sumApprovedQuantityDelta,
  type ApprovedOwnerVariationLine,
} from '../../modules/contracting/variation/contract-variation-effective.service';
import { ContractVariationOverCertificationError } from '../../modules/contracting/variation/variation-domain.errors';

function line(
  partial: Partial<ApprovedOwnerVariationLine> & {
    changeType: ApprovedOwnerVariationLine['changeType'];
    projectBOQItemId: string;
  }
): ApprovedOwnerVariationLine {
  return {
    quantityDelta: new Decimal(0),
    approvedRate: null,
    approvedAt: new Date('2026-01-01'),
    sequenceNumber: 1,
    ...partial,
  };
}

describe('contract variation effective quantities', () => {
  const boqId = 'boq-1';
  const baseQty = new Decimal(100);

  it('sums quantity deltas from QUANTITY_CHANGE and OMIT only', () => {
    const lines = [
      line({ changeType: 'QUANTITY_CHANGE', projectBOQItemId: boqId, quantityDelta: new Decimal(10) }),
      line({ changeType: 'RATE_CHANGE', projectBOQItemId: boqId, quantityDelta: new Decimal(5) }),
      line({ changeType: 'OMIT', projectBOQItemId: boqId, quantityDelta: new Decimal(-3) }),
    ];
    expect(sumApprovedQuantityDelta(lines, boqId).toString()).toBe('7');
  });

  it('applies effective quantity as base plus approved deltas', () => {
    const lines = [
      line({ changeType: 'QUANTITY_CHANGE', projectBOQItemId: boqId, quantityDelta: new Decimal(25) }),
    ];
    const effective = resolveEffectiveOwnerBoqQuantityFromBase(baseQty, lines, boqId);
    expect(effective.toString()).toBe('125');
  });

  it('floors effective quantity at zero', () => {
    const lines = [
      line({ changeType: 'OMIT', projectBOQItemId: boqId, quantityDelta: new Decimal(-500) }),
    ];
    const effective = resolveEffectiveOwnerBoqQuantityFromBase(baseQty, lines, boqId);
    expect(effective.toString()).toBe('0');
  });
});

describe('contract variation effective rate', () => {
  const boqId = 'boq-1';
  const baseRate = new Decimal(1000);

  it('applies RATE_CHANGE lines in chronological approval order', () => {
    const lines = [
      line({
        changeType: 'RATE_CHANGE',
        projectBOQItemId: boqId,
        approvedRate: new Decimal(1100),
        approvedAt: new Date('2026-02-01'),
        sequenceNumber: 1,
      }),
      line({
        changeType: 'RATE_CHANGE',
        projectBOQItemId: boqId,
        approvedRate: new Decimal(1200),
        approvedAt: new Date('2026-03-01'),
        sequenceNumber: 2,
      }),
    ];
    const rate = resolveEffectiveOwnerBoqRateFromLines(baseRate, lines, boqId);
    expect(rate.toString()).toBe('1200');
  });
});

describe('ContractVariationOverCertificationError', () => {
  it('exposes breach details for API consumers', () => {
    const err = new ContractVariationOverCertificationError([
      {
        projectBOQItemId: 'boq-1',
        itemCode: 'A.01',
        previousCertifiedQuantity: '90',
        effectiveQuantityAfter: '80',
      },
    ]);
    expect(err.code).toBe('CONTRACT_VARIATION_OVER_CERTIFICATION');
    expect(err.statusCode).toBe(422);
    expect((err.details as { breaches: unknown[] }).breaches).toHaveLength(1);
  });
});
