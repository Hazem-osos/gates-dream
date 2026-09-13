import { redirect } from 'next/navigation';

export default function CostCenterMovementRedirectPage() {
  redirect('/accounting/tools/transfer-cost-center');
}
