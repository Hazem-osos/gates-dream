import { redirect } from 'next/navigation';

export default function CostCenterBalanceePreviewRedirect() {
  redirect('/accounting/account-reports/balances/cost-center-balance/preview');
}
