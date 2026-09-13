import { redirect } from 'next/navigation';
import { contextFromSettingsSlug, settingsPageHref } from '@/lib/transaction-settings/types';

export default async function TransactionSettingsRedirectPage({
  params,
}: {
  params: Promise<{ documentType: string }>;
}) {
  const { documentType } = await params;
  const ctx = contextFromSettingsSlug(documentType);
  redirect(ctx ? settingsPageHref(ctx.documentType) : '/inventory');
}
