'use client';

import { SalesOrderForm } from '@/components/inventory/sales-order/SalesOrderForm';

/** Manufacturing flow: customer + items → work order (no sales invoice / commercial extras). */
export function ManufacturingSalesOrderForm() {
  return <SalesOrderForm context="manufacturing" />;
}
