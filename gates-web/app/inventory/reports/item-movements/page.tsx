import { redirect } from 'next/navigation';

/**
 * M21 fix (Item 36): this catalog entry duplicated the real, working
 * "تقرير حركة الأصناف" report at /inventory/reports/item-movement-reports
 * (backed by GET /api/v1/inventory/reports/item-movement) — same
 * resolution pattern already used for the sibling `expiry` stub.
 */
export default function ItemMovementsStubPage() {
  redirect('/inventory/reports/item-movement-reports');
}
