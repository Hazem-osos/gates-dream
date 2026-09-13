import { redirect } from 'next/navigation';

export default function RouteAliasPage() {
  redirect('/accounting-settings/company-settings/income-statement-settings');
}
