import { test } from 'vitest';
import { groupStockTransferRows, roundMoney } from './stockTransferGroups';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const groups = groupStockTransferRows([
  { transferId: 'a', serial: 'TRF-1', total: 10.5 },
  { transferId: 'a', serial: 'TRF-1', total: 4.5 },
  { transferId: 'b', serial: '', total: 7 },
]);

assert(groups.length === 2, 'one group per transfer');
assert(groups[0].serial === 'TRF-1', 'keeps the document serial');
assert(groups[0].lines.length === 2, 'keeps both lines of the first transfer');
assert(groups[0].total === 15, 'totals the first transfer before the break');
assert(groups[1].transferId === 'b', 'second transfer stays separate');
assert(groups[1].total === 7, 'totals the second transfer');
assert(roundMoney(0.1 + 0.2) === 0.3, 'money rounds to cents');

test('stock transfer groups', () => {});
