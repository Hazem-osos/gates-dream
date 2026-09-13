import { redirect } from 'next/navigation';

export default async function SalesQuoteIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/inventory/operations/price-quote?quoteId=${encodeURIComponent(id)}`);
}
