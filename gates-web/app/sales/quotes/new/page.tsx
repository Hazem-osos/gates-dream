import { redirect } from 'next/navigation';

export default function SalesQuoteNewRedirectPage() {
  redirect('/inventory/operations/price-quote');
}
