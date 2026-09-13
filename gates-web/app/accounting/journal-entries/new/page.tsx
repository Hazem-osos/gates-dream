import { redirect } from 'next/navigation';

export default function JournalEntriesNewRedirectPage() {
  redirect('/accounting/operations/journal-entry');
}
