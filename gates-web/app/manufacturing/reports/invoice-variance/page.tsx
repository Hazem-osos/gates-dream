import { redirect } from 'next/navigation';

/** Report retired — use «انحراف تكاليف التصنيع» instead. */
export default function InvoiceVarianceReportPage() {
  redirect('/manufacturing/reports/cost-variance');
}
