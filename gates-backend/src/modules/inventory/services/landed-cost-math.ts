import { roundTo4 } from '../../../shared/utils/decimal-round';

export interface LandedCostSplitInput {
  allocatedCost: number;
  receivedQty: number;
  onHandQty: number;
}

export interface LandedCostSplit {
  unitCostDelta: number;
  soldQuantity: number;
  capitalizeQuantity: number;
  capitalizeAmount: number;
  cogsTrueUpAmount: number;
}

/**
 * Split a landed-cost allocation between remaining on-hand stock (capitalize
 * into warehouse MAC) and already-sold quantity (retroactive COGS true-up).
 * Remainder is forced onto the COGS leg so the two amounts always sum to
 * the allocated cost.
 */
export function splitLandedCostCapitalization(input: LandedCostSplitInput): LandedCostSplit {
  const allocatedCost = roundTo4(Number(input.allocatedCost) || 0);
  const receivedQty = Number(input.receivedQty) || 0;
  const onHandQty = Math.max(0, Number(input.onHandQty) || 0);

  if (allocatedCost === 0 || receivedQty <= 0) {
    return {
      unitCostDelta: 0,
      soldQuantity: 0,
      capitalizeQuantity: 0,
      capitalizeAmount: 0,
      cogsTrueUpAmount: 0,
    };
  }

  const unitCostDelta = roundTo4(allocatedCost / receivedQty);
  const capitalizeQuantity = Math.min(onHandQty, receivedQty);
  const soldQuantity = Math.max(0, receivedQty - onHandQty);
  const capitalizeAmount =
    soldQuantity === 0 ? allocatedCost : roundTo4(capitalizeQuantity * unitCostDelta);
  const cogsTrueUpAmount = roundTo4(allocatedCost - capitalizeAmount);

  return {
    unitCostDelta,
    soldQuantity,
    capitalizeQuantity,
    capitalizeAmount,
    cogsTrueUpAmount,
  };
}
