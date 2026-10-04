'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';

type CustomerRow = { id: string; arabicName: string };

export default function NewTenderPage() {
  const router = useRouter();
  const customersQ = useApiQuery<CustomerRow[]>(['tender-new-customers'], '/accounting/customers', { limit: 500 });
  const create = useApiMutation<{ id: string }, { customerId: string; nameAr: string; currencyCode?: string; description?: string }>(
    '/contracting/tenders',
    'POST'
  );

  const [customerId, setCustomerId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [currencyCode, setCurrencyCode] = useState('EGP');

  const customers = customersQ.data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="عطاء جديد"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { href: '/contracting/tenders', label: 'العطاءات' },
        { label: 'جديد' },
      ]}
      hideSave
      onNew={undefined}
      extraActions={
        <Link href="/contracting/tenders" className="rounded-xl border px-4 py-2 text-sm font-bold">
          رجوع
        </Link>
      }
    >
      <div className="mx-auto max-w-xl rounded-2xl border bg-surface-1 p-6 space-y-4 text-sm">
        {customersQ.isLoading ? <p className="text-muted-foreground">جاري تحميل العملاء…</p> : null}
        {customersQ.isError ? (
          <p className="text-destructive">تعذر تحميل قائمة العملاء. حاول مرة أخرى.</p>
        ) : null}
        <label className="block space-y-1">
          <span className="font-bold text-brand">العميل</span>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">— اختر العميل —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.arabicName}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-bold text-brand">اسم العطاء</span>
          <input className="w-full rounded-lg border px-3 py-2" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-bold text-brand">العملة</span>
          <input className="w-full rounded-lg border px-3 py-2" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-bold text-brand">ملاحظات / وصف</span>
          <textarea className="w-full rounded-lg border px-3 py-2" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Link href="/contracting/tenders" className="rounded-lg border px-4 py-2">
            إلغاء
          </Link>
          <button
            type="button"
            disabled={!customerId || !nameAr.trim() || create.isPending}
            className="rounded-lg bg-brand px-4 py-2 font-bold text-white disabled:opacity-50"
            onClick={async () => {
              const res = await create.mutateAsync({
                customerId,
                nameAr: nameAr.trim(),
                currencyCode: currencyCode.trim() || 'EGP',
                description: description.trim() || undefined,
              });
              const id = res.data?.id;
              if (id) router.push(`/contracting/tenders/${id}`);
            }}
          >
            إنشاء العطاء
          </button>
        </div>
      </div>
    </ExtractsPageChrome>
  );
}
