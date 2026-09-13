import { redirect } from 'next/navigation';

export default function PurchaseInvoiceNewRedirectPage() {
  redirect('/inventory/operations/final-purchase-invoice');
}
