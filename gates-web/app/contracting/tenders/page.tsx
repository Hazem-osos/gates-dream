'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApiQuery } from '@/lib/hooks/useApi';
import { TENDER_STATUS_AR } from '@/components/contracting/tender/tender-labels';

type TenderRow = {
  id: string;
  tenderNumber: string;
  nameAr: string;
  status: string;
  customer: { arabicName: string };
};

export default function TendersListPage() {
  const router = useRouter();
  const q = useApiQuery<TenderRow[]>(['contracting-tenders'], '/contracting/tenders');
  const rows = q.data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="العطاءات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'العطاءات' },
      ]}
      statusLabel="عرض"
      favoriteHref="/contracting/tenders"
      hideSave
      onNew={() => router.push('/contracting/tenders/new')}
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد عطاءات"
          description="أنشئ عطاءاً جديداً لبدء الدراسة والتسعير والترسية."
          action={
            <Link href="/contracting/tenders/new" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
              عطاء جديد
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-surface-1">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--info-soft)]">
              <tr>
                <th className="px-3 py-2 text-right">رقم العطاء</th>
                <th className="px-3 py-2 text-right">العميل</th>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/contracting/tenders/${t.id}`} className="font-mono text-brand underline">
                      {t.tenderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{t.customer.arabicName}</td>
                  <td className="px-3 py-2">{t.nameAr}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={TENDER_STATUS_AR[t.status] ?? t.status}
                      tone={t.status === 'AWARDED' ? 'success' : t.status === 'LOST' ? 'danger' : 'info'}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ExtractsPageChrome>
  );
}
