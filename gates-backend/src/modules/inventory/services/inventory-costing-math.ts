import { roundTo4 } from '../../../shared/utils/decimal-round';

/** Canonical costing movement families (Delphi AdjustItemsCost / frmRepairCost). */
export const COSTING_MOVEMENT = {
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  RETURN_PURCHASE: 'RETURN_PURCHASE',
  RETURN_SALE: 'RETURN_SALE',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  ADJUSTMENT_POSITIVE: 'ADJUSTMENT_POSITIVE',
  ADJUSTMENT_NEGATIVE: 'ADJUSTMENT_NEGATIVE',
  ASSEMBLY_IN: 'ASSEMBLY_IN',
  ASSEMBLY_OUT: 'ASSEMBLY_OUT',
} as const;

export type CostingMovementType = (typeof COSTING_MOVEMENT)[keyof typeof COSTING_MOVEMENT];

export const INBOUND_COSTING_TYPES = new Set<string>([
  COSTING_MOVEMENT.PURCHASE,
  COSTING_MOVEMENT.RETURN_SALE,
  COSTING_MOVEMENT.TRANSFER_IN,
  COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
  COSTING_MOVEMENT.ASSEMBLY_IN,
]);

export const OUTBOUND_COSTING_TYPES = new Set<string>([
  COSTING_MOVEMENT.SALE,
  COSTING_MOVEMENT.RETURN_PURCHASE,
  COSTING_MOVEMENT.TRANSFER_OUT,
  COSTING_MOVEMENT.ADJUSTMENT_NEGATIVE,
  COSTING_MOVEMENT.ASSEMBLY_OUT,
]);

export interface RunningCostState {
  quantity: number;
  averageCost: number;
}

export interface OutboundValuation {
  unitCost: number;
  totalValuation: number;
  quantityOnHand: number;
  averageCost: number;
}

/**
 * Moving weighted average cost (MAC).
 *
 * NewCost = (Q_exist * C_curr + Q_in * C_in) / (Q_exist + Q_in)
 *
 * Edge cases:
 * - Q_exist ≤ 0 (zero or negative stock): NewCost = C_in
 * - Q_exist + Q_in = 0: keep previous cost, else fall back to C_in
 * - Weighted result < 0: fall back to C_in
 */
export function computeMovingAverageCost(params: {
  existingQty: number;
  currentCost: number;
  inboundQty: number;
  inboundCost: number;
}): number {
  const existingQty = Number(params.existingQty) || 0;
  const currentCost = Number(params.currentCost) || 0;
  const inboundQty = Number(params.inboundQty) || 0;
  const inboundCost = Number(params.inboundCost) || 0;

  if (existingQty <= 0) {
    return roundTo4(inboundCost);
  }

  const newQty = existingQty + inboundQty;
  if (newQty === 0) {
    return roundTo4(currentCost !== 0 ? currentCost : inboundCost);
  }

  const weighted = (existingQty * currentCost + inboundQty * inboundCost) / newQty;
  if (weighted < 0) {
    return roundTo4(inboundCost);
  }
  return roundTo4(weighted);
}

export function applyInboundToState(
  state: RunningCostState,
  inboundQty: number,
  inboundCost: number
): RunningCostState {
  const nextCost = computeMovingAverageCost({
    existingQty: state.quantity,
    currentCost: state.averageCost,
    inboundQty,
    inboundCost,
  });
  return {
    quantity: roundTo4(state.quantity + inboundQty),
    averageCost: nextCost,
  };
}

export function applyOutboundToState(
  state: RunningCostState,
  outboundQty: number
): OutboundValuation {
  const unitCost = roundTo4(state.averageCost);
  return {
    unitCost,
    totalValuation: roundTo4(outboundQty * unitCost),
    quantityOnHand: roundTo4(state.quantity - outboundQty),
    averageCost: unitCost,
  };
}

export function computeAssemblyUnitCost(
  componentValuations: number[],
  assembledQty: number
): number {
  const total = componentValuations.reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (assembledQty <= 0) return 0;
  return roundTo4(total / assembledQty);
}

export function computeGlobalAverageCost(
  warehouses: Array<{ quantityOnHand: number; averageCost: number }>,
  fallbackCost = 0
): number {
  let qty = 0;
  let value = 0;
  for (const row of warehouses) {
    const q = Number(row.quantityOnHand) || 0;
    if (q <= 0) continue;
    qty += q;
    value += q * (Number(row.averageCost) || 0);
  }
  if (qty <= 0) return roundTo4(fallbackCost);
  return roundTo4(value / qty);
}

export function isInboundCostingMovement(movementType: string, quantityDelta?: number): boolean {
  if (INBOUND_COSTING_TYPES.has(movementType)) return true;
  if (OUTBOUND_COSTING_TYPES.has(movementType)) return false;
  if (quantityDelta != null) return quantityDelta > 0;
  return false;
}

export function isOutboundCostingMovement(movementType: string, quantityDelta?: number): boolean {
  if (OUTBOUND_COSTING_TYPES.has(movementType)) return true;
  if (INBOUND_COSTING_TYPES.has(movementType)) return false;
  if (quantityDelta != null) return quantityDelta < 0;
  return false;
}

export interface ReplayMovement {
  warehouseId: string;
  quantityDelta: number;
  unitCost: number;
  movementType: string;
}

export interface ReplayResult {
  global: RunningCostState;
  warehouses: Record<string, RunningCostState>;
  lines: Array<{
    unitCost: number;
    resultingAverageCost: number;
    inbound: boolean;
  }>;
}

/** Chronological MAC replay used by frmRepairCost / recalculateItemCostHistory. */
export function replayItemCostHistory(
  movements: ReplayMovement[],
  opening: { global?: RunningCostState; warehouses?: Record<string, RunningCostState> } = {}
): ReplayResult {
  const global: RunningCostState = {
    quantity: opening.global?.quantity ?? 0,
    averageCost: opening.global?.averageCost ?? 0,
  };
  const warehouses: Record<string, RunningCostState> = {};
  for (const [id, state] of Object.entries(opening.warehouses ?? {})) {
    warehouses[id] = { quantity: state.quantity, averageCost: state.averageCost };
  }

  const lines: ReplayResult['lines'] = [];
  for (const movement of movements) {
    const qty = Number(movement.quantityDelta) || 0;
    const inbound = isInboundCostingMovement(movement.movementType, qty);
    const warehouse = warehouses[movement.warehouseId] ?? {
      quantity: 0,
      averageCost: global.averageCost,
    };

    if (inbound) {
      const inboundQty = Math.abs(qty);
      const inboundCost = Number(movement.unitCost) || 0;
      const nextWarehouse = applyInboundToState(warehouse, inboundQty, inboundCost);
      const nextGlobal = applyInboundToState(global, inboundQty, inboundCost);
      warehouses[movement.warehouseId] = nextWarehouse;
      global.quantity = nextGlobal.quantity;
      global.averageCost = nextGlobal.averageCost;
      lines.push({
        unitCost: roundTo4(inboundCost),
        resultingAverageCost: nextWarehouse.averageCost,
        inbound: true,
      });
    } else {
      const outboundQty = Math.abs(qty);
      const snapshot = warehouse.averageCost || global.averageCost;
      const outbound = applyOutboundToState({ ...warehouse, averageCost: snapshot }, outboundQty);
      warehouses[movement.warehouseId] = {
        quantity: outbound.quantityOnHand,
        averageCost: snapshot,
      };
      global.quantity = roundTo4(global.quantity - outboundQty);
      lines.push({
        unitCost: outbound.unitCost,
        resultingAverageCost: snapshot,
        inbound: false,
      });
    }
  }

  return { global, warehouses, lines };
}
