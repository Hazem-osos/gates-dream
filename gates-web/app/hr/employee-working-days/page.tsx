import { redirect } from 'next/navigation';

/** Legacy screen — weekly working days now live in HCM work schedules. */
export default function RouteAliasPage() {
  redirect('/hr/attendance/schedules');
}
