import { redirect } from 'next/navigation';

export default async function ContractingProjectIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/contracting/projects/${id}/technical-office`);
}
