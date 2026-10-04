import {
  assertAllocationWithinRemaining,
  assertPositiveAllocationAmount,
  deriveContractingSettlementStatus,
} from '../../modules/contracting/settlement/contracting-settlement-status';

describe('contracting settlement status (P0-2)', () => {
  it('derives UNPAID / PARTIALLY_SETTLED / SETTLED', () => {
    expect(deriveContractingSettlementStatus(0, 100_000)).toBe('UNPAID');
    expect(deriveContractingSettlementStatus(30_000, 100_000)).toBe('PARTIALLY_SETTLED');
    expect(deriveContractingSettlementStatus(100_000, 100_000)).toBe('SETTLED');
  });

  it('rejects invalid allocation amounts', () => {
    expect(() => assertPositiveAllocationAmount(0)).toThrow('ALLOCATION_AMOUNT_INVALID');
    expect(() => assertPositiveAllocationAmount(-1)).toThrow('ALLOCATION_AMOUNT_INVALID');
    expect(() => assertPositiveAllocationAmount(1)).not.toThrow();
  });

  it('rejects over-allocation', () => {
    expect(() => assertAllocationWithinRemaining(70_001, 70_000)).toThrow(
      'ALLOCATION_EXCEEDS_REMAINING'
    );
    expect(() => assertAllocationWithinRemaining(70_000, 70_000)).not.toThrow();
  });

  it('full owner scenario: 30k then 70k then reject +1', () => {
    let collected = 0;
    const eligible = 100_000;
    collected += 30_000;
    expect(deriveContractingSettlementStatus(collected, eligible)).toBe('PARTIALLY_SETTLED');
    expect(eligible - collected).toBe(70_000);

    assertAllocationWithinRemaining(70_000, eligible - collected);
    collected += 70_000;
    expect(deriveContractingSettlementStatus(collected, eligible)).toBe('SETTLED');

    expect(() => assertAllocationWithinRemaining(1, eligible - collected)).toThrow();
  });

  it('reversal: collected drops when allocation stops being active', () => {
    const eligible = 100_000;
    const activeCollected = 30_000;
    expect(deriveContractingSettlementStatus(activeCollected, eligible)).toBe('PARTIALLY_SETTLED');
    const afterUnpost = 0;
    expect(deriveContractingSettlementStatus(afterUnpost, eligible)).toBe('UNPAID');
    expect(eligible - afterUnpost).toBe(100_000);
  });
});
