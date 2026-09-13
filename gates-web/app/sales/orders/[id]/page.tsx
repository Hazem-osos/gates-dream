import { redirect } from 'next/navigation';

export default async function SalesOrderIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/inventory/operations/sales-order?orderId=${encodeURIComponent(id)}`);
}
