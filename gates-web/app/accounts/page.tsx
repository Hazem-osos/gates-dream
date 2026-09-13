import { redirect } from 'next/navigation';

/** Legacy / mistaken URLs from sidebar keys → real routes */
export default function AccountsRedirectPage() {
  redirect('/accounting');
}
