import { redirect } from 'next/navigation';

export default function BankCreditNoteRedirectPage() {
  redirect('/accounting/operations/banks/bank-addition');
}
