import { redirect } from 'next/navigation';

export default function PurchaseReturnsRedirectPage() {
  redirect('/inventory/operations/purchase-returns');
}
