import { redirect } from 'next/navigation';

/** Legacy company-data screen — basics now live on /settings/company */
export default function CompanyDataPage() {
  redirect('/settings/company');
}
