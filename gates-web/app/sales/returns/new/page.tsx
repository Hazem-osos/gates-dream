import { redirect } from 'next/navigation';

export default function SalesReturnNewRedirectPage() {
  redirect('/inventory/operations/sales-returns');
}
