import { redirect } from 'next/navigation';

export default function TemporaryReceiptRedirectPage() {
  redirect('/accounting/operations/treasury/temp-receipt');
}
