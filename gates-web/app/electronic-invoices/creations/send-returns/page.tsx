import { redirect } from 'next/navigation';

export default function SendReturnsPage() {
  redirect('/electronic-invoices/creations/send-invoice?view=credit');
}
