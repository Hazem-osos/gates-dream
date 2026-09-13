import type { OpportunityDetector } from '../types';
import { CrossSellDetector } from './cross-sell.detector';
import { ExpenseAnomaliesDetector } from './expense-anomalies.detector';
import { HighMarginProductsDetector } from './high-margin-products.detector';
import { InactiveCustomersDetector } from './inactive-customers.detector';
import { MarginProblemsDetector } from './margin-problems.detector';
import { OverdueReceivablesDetector } from './overdue-receivables.detector';
import { SlowMovingInventoryDetector } from './slow-moving-inventory.detector';
import { UpsellDetector } from './upsell.detector';

export const GROWTH_DETECTORS: OpportunityDetector[] = [
  new OverdueReceivablesDetector(),
  new InactiveCustomersDetector(),
  new SlowMovingInventoryDetector(),
  new HighMarginProductsDetector(),
  new MarginProblemsDetector(),
  new CrossSellDetector(),
  new UpsellDetector(),
  new ExpenseAnomaliesDetector(),
];
