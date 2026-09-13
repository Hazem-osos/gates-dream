import { redirect } from 'next/navigation';

export default function BankDebitNoteRedirectPage() {
  redirect('/accounting/operations/banks/bank-discount');
}
