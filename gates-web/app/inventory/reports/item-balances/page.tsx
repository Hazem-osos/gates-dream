import { redirect } from 'next/navigation';

/**
 * M21 fix (Item 36): this catalog entry duplicated the real, working
 * "تقارير جرد الأصناف" (item stock balances) report at
 * /inventory/reports/inventory-reports — same resolution pattern already
 * used for the sibling `valuation` stub.
 */
export default function ItemBalancesStubPage() {
  redirect('/inventory/reports/inventory-reports');
}
