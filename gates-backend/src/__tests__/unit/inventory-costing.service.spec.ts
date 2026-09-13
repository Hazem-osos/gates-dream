import {
  applyInboundToState,
  applyOutboundToState,
  computeAssemblyUnitCost,
  computeMovingAverageCost,
  replayItemCostHistory,
} from '../../modules/inventory/services/inventory-costing-math';

describe('InventoryCostingService', () => {
  it('computes MAC: buy 10 @ 100 then 10 @ 120 → average 110', () => {
    let state = { quantity: 0, averageCost: 0 };
    state = applyInboundToState(state, 10, 100);
    expect(state).toEqual({ quantity: 10, averageCost: 100 });

    state = applyInboundToState(state, 10, 120);
    expect(state.quantity).toBe(20);
    expect(state.averageCost).toBe(110);
  });

  it('keeps MAC on a partial sale and returns COGS = qty × average', () => {
    let state = applyInboundToState({ quantity: 0, averageCost: 0 }, 10, 100);
    state = applyInboundToState(state, 10, 120);

    const sale = applyOutboundToState(state, 5);
    expect(sale.unitCost).toBe(110);
    expect(sale.totalValuation).toBe(550);
    expect(sale.quantityOnHand).toBe(15);
    expect(sale.averageCost).toBe(110);
  });

  it('resets average cost to inbound price when existing stock is zero or negative', () => {
    const fromZero = computeMovingAverageCost({
      existingQty: 0,
      currentCost: 80,
      inboundQty: 10,
      inboundCost: 100,
    });
    expect(fromZero).toBe(100);

    const fromNegative = applyInboundToState({ quantity: -3, averageCost: 80 }, 10, 100);
    expect(fromNegative.averageCost).toBe(100);
    expect(fromNegative.quantity).toBe(7);
  });

  it('keeps the previous cost when inbound nets existing quantity to zero', () => {
    const kept = computeMovingAverageCost({
      existingQty: 10,
      currentCost: 110,
      inboundQty: -10,
      inboundCost: 50,
    });
    expect(kept).toBe(110);
  });

  it('rolls assembly BOM cost into the finished-item unit cost', () => {
    const componentA = applyOutboundToState({ quantity: 20, averageCost: 110 }, 5);
    const componentB = applyOutboundToState({ quantity: 8, averageCost: 50 }, 2);
    const assembledQty = 4;
    const unitCost = computeAssemblyUnitCost(
      [componentA.totalValuation, componentB.totalValuation],
      assembledQty
    );

    expect(componentA.totalValuation).toBe(550);
    expect(componentB.totalValuation).toBe(100);
    expect(unitCost).toBe(162.5);

    const finished = applyInboundToState({ quantity: 0, averageCost: 0 }, assembledQty, unitCost);
    expect(finished.averageCost).toBe(162.5);
    expect(finished.quantity).toBe(4);
  });

  it('replays history so outbound lines inherit the running MAC (frmRepairCost)', () => {
    const replay = replayItemCostHistory([
      { warehouseId: 'wh-1', quantityDelta: 10, unitCost: 100, movementType: 'PURCHASE' },
      { warehouseId: 'wh-1', quantityDelta: 10, unitCost: 120, movementType: 'PURCHASE' },
      { warehouseId: 'wh-1', quantityDelta: -5, unitCost: 0, movementType: 'SALE' },
    ]);

    expect(replay.global.quantity).toBe(15);
    expect(replay.global.averageCost).toBe(110);
    expect(replay.lines[2]).toEqual({
      unitCost: 110,
      resultingAverageCost: 110,
      inbound: false,
    });
  });
});
