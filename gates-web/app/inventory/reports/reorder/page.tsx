import { redirect } from 'next/navigation';

export default function RouteAliasPage() {
  redirect('/inventory/reports/items-exceeding-order-limit');
}
