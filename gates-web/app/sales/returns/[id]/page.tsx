import { redirect } from 'next/navigation';

export default async function SalesReturnIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/inventory/operations/sales-returns?invoiceId=${encodeURIComponent(id)}`);
}
