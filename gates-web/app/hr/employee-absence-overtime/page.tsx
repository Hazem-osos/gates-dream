import { redirect } from 'next/navigation';

/** Legacy screen — replaced by the HCM workflow at /hr/attendance/exceptions. */
export default function RouteAliasPage() {
  redirect('/hr/attendance/exceptions');
}
