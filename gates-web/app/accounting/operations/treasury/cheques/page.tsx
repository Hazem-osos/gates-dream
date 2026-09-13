import { redirect } from 'next/navigation';

/** Legacy UUID-lookup screen — portfolio lives on incoming/outgoing now. */
export default function TreasuryChequesRedirectPage() {
  redirect('/accounting/cheques/incoming');
}
