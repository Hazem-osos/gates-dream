import { redirect } from 'next/navigation';

/** Legacy screen — replaced by the HCM workflow at /hr/attendance/corrections. */
export default function RouteAliasPage() {
  redirect('/hr/attendance/corrections');
}
