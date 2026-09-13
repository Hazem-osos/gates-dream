import { redirect } from 'next/navigation';

export default function JournalEntriesRedirectPage() {
  redirect('/accounting/operations/journal-entry');
}
