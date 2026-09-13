import { redirect } from 'next/navigation';

export default async function SalesOrderNewRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; invoiceId?: string }>;
}) {
  const params = await searchParams;
  const id = params.orderId || params.invoiceId;
  const qs = id ? `?orderId=${encodeURIComponent(id)}` : '';
  redirect(`/inventory/operations/sales-order${qs}`);
}
