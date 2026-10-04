import { redirect } from 'next/navigation';

export default function SendAmendmentsPage() {
  redirect('/electronic-invoices/creations/send-invoice?view=debit');
}
