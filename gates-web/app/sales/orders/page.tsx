import { redirect } from 'next/navigation';

export default function SalesOrdersRedirectPage() {
  redirect('/inventory/operations/sales-order');
}
