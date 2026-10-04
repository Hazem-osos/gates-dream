import { redirect } from 'next/navigation';

export default function CostCenterBalanceeRedirect() {
  redirect('/accounting/account-reports/balances/cost-center-balance');
}
