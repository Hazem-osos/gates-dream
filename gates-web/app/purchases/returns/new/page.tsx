import { redirect } from 'next/navigation';

export default function PurchaseReturnNewRedirectPage() {
  redirect('/inventory/operations/purchase-returns');
}
