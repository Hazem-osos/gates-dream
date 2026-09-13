import { redirect } from 'next/navigation';

export default function BulkCreateReceiptPapersRedirectPage() {
  redirect('/treasury/papers/batch-receipt/new');
}
