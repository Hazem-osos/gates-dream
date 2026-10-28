import { redirect } from 'next/navigation';

/** Legacy screen — replaced by the HCM workflow at /hr/attendance/period-review. */
export default function RouteAliasPage() {
  redirect('/hr/attendance/period-review');
}
