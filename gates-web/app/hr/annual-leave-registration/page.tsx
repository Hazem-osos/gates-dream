import { redirect } from 'next/navigation';

/** Legacy screen — replaced by the HCM workflow at /hr/leave/requests/new. */
export default function RouteAliasPage() {
  redirect('/hr/leave/requests/new');
}
