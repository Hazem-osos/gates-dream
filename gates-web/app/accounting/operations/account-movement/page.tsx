import { redirect } from 'next/navigation';

export default function AccountMovementRedirectPage() {
  redirect('/accounting/tools/transfer-account');
}
