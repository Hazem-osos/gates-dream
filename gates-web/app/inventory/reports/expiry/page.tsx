import { redirect } from 'next/navigation';

export default function RouteAliasPage() {
  redirect('/inventory/reports/expiry-date-report');
}
