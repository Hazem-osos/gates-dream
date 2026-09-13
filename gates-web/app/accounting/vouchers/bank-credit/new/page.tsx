import { redirect } from 'next/navigation';

export default function BankCreditNoteNewRedirectPage() {
  redirect('/accounting/operations/banks/bank-addition');
}
