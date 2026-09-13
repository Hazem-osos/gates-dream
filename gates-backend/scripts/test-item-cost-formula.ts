/**
 * Item cost formula parity (Delphi GetItemCost core math).
 * Run: npx tsx scripts/test-item-cost-formula.ts
 */
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const svc = itemCostService;

assertClose(
  svc.computeMovingAverage({
    oldCost: 0,
    oldItemCount: 0,
    itemCount: 100,
    itemPrice: 10,
    change: 1,
  }),
  10,
  'first receipt'
);

assertClose(
  svc.computeMovingAverage({
    oldCost: 10,
    oldItemCount: 100,
    itemCount: 50,
    itemPrice: 12,
    change: 1,
  }),
  10.6667,
  'second receipt weighted avg'
);

assertClose(
  svc.computeMovingAverage({
    oldCost: 5,
    oldItemCount: -10,
    itemCount: 10,
    itemPrice: 8,
    change: 1,
  }),
  8,
  'non-positive total qty fallback'
);

assertClose(
  svc.computeMovingAverage({
    oldCost: 10,
    oldItemCount: 1,
    itemCount: 1,
    itemPrice: 5,
    change: 2,
  }),
  10,
  'negative weighted avg fallback'
);

console.log('Item cost formula tests — PASSED');
