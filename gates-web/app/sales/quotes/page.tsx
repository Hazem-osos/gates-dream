import { redirect } from 'next/navigation';

export default function SalesQuotesRedirectPage() {
  redirect('/inventory/operations/price-quote');
}
