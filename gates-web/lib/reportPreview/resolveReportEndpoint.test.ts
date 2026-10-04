import {
  resolveReportApiPath,
  ensureReportPreviewDates,
  reportPreviewNeedsDateRange,
} from './resolveReportEndpoint';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(resolveReportApiPath('pos/daily') === '/pos/daily-report', 'pos daily api path');
assert(
  ensureReportPreviewDates({}, 'pos/daily').date?.length === 10,
  'pos daily fills date'
);
assert(
  ensureReportPreviewDates({ date: '2026-09-17' }, 'pos/daily').date === '2026-09-17',
  'pos daily keeps date'
);

assert(
  resolveReportApiPath('inventory/reports/item-movement-reports') ===
    '/inventory/reports/item-movement',
  'item movement api path'
);
assert(
  resolveReportApiPath('inventory/reports/expiry-date-report') === '/inventory/reports/expiry-date',
  'expiry api path'
);
assert(
  !reportPreviewNeedsDateRange('inventory/reports/inventory-reports'),
  'stock take skips dates'
);
assert(
  !reportPreviewNeedsDateRange('inventory/reports/price-list'),
  'price list skips dates'
);
assert(
  reportPreviewNeedsDateRange('inventory/reports/items-exceeding-order-limit'),
  'order limit report uses dates'
);
assert(
  ensureReportPreviewDates({}, 'inventory/reports/sales-reports').fromDate?.endsWith('-01-01'),
  'sales default from year start'
);

console.log('resolveReportEndpoint.test.ts ok');
test('report endpoint assertions', () => {});
