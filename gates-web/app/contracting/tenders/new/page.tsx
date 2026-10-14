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
  const create = useApiMutation<{ id: string }, Record<string, unknown>>('/contracting/tenders', 'POST');

  const [form, setForm] = useState({
    customerId: '',
    nameAr: '',
    description: '',
    currencyCode: 'EGP',
    consultantName: '',
    projectManagerName: '',
    fundingSource: '',
    location: '',
    submissionDeadline: '',
    expectedStart: '',
    expectedEnd: '',
    contractDurationDays: '',
    delayPenaltyRate: '',
  });

  const customers = customersQ.data?.data ?? [];
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

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
      <div className="mx-auto max-w-3xl rounded-2xl border bg-surface-1 p-6 space-y-4 text-sm">
        {customersQ.isLoading ? <p className="text-muted-foreground">جاري تحميل العملاء…</p> : null}
        {customersQ.isError ? (
          <p className="text-destructive">تعذر تحميل قائمة العملاء. حاول مرة أخرى.</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="font-bold text-brand">المالك / العميل</span>
            <select className="w-full rounded-lg border px-3 py-2" value={form.customerId} onChange={set('customerId')}>
              <option value="">— اختر المالك —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.arabicName}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="font-bold text-brand">اسم العطاء</span>
            <input className="w-full rounded-lg border px-3 py-2" value={form.nameAr} onChange={set('nameAr')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">الاستشاري</span>
            <input className="w-full rounded-lg border px-3 py-2" value={form.consultantName} onChange={set('consultantName')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">مدير المشروع</span>
            <input className="w-full rounded-lg border px-3 py-2" value={form.projectManagerName} onChange={set('projectManagerName')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">مصدر التمويل</span>
            <input className="w-full rounded-lg border px-3 py-2" value={form.fundingSource} onChange={set('fundingSource')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">موقع المشروع</span>
            <input className="w-full rounded-lg border px-3 py-2" value={form.location} onChange={set('location')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">العملة</span>
            <input className="w-full rounded-lg border px-3 py-2" value={form.currencyCode} onChange={set('currencyCode')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">موعد التقديم</span>
            <input type="date" className="w-full rounded-lg border px-3 py-2" value={form.submissionDeadline} onChange={set('submissionDeadline')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">بداية المشروع</span>
            <input type="date" className="w-full rounded-lg border px-3 py-2" value={form.expectedStart} onChange={set('expectedStart')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">نهاية المشروع</span>
            <input type="date" className="w-full rounded-lg border px-3 py-2" value={form.expectedEnd} onChange={set('expectedEnd')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">مدة العقد (يوم)</span>
            <input type="number" className="w-full rounded-lg border px-3 py-2" value={form.contractDurationDays} onChange={set('contractDurationDays')} />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-brand">غرامة التأخير (0.01 = 1%)</span>
            <input type="number" step="0.0001" className="w-full rounded-lg border px-3 py-2" value={form.delayPenaltyRate} onChange={set('delayPenaltyRate')} />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="font-bold text-brand">ملاحظات / وصف</span>
            <textarea className="w-full rounded-lg border px-3 py-2" rows={3} value={form.description} onChange={set('description')} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Link href="/contracting/tenders" className="rounded-lg border px-4 py-2">
            إلغاء
          </Link>
          <button
            type="button"
            disabled={!form.customerId || !form.nameAr.trim() || create.isPending}
            className="rounded-lg bg-brand px-4 py-2 font-bold text-white disabled:opacity-50"
            onClick={async () => {
              const res = await create.mutateAsync({
                customerId: form.customerId,
                nameAr: form.nameAr.trim(),
                currencyCode: form.currencyCode.trim() || 'EGP',
                description: form.description.trim() || undefined,
                consultantName: form.consultantName.trim() || undefined,
                projectManagerName: form.projectManagerName.trim() || undefined,
                fundingSource: form.fundingSource.trim() || undefined,
                location: form.location.trim() || undefined,
                submissionDeadline: form.submissionDeadline || undefined,
                expectedStart: form.expectedStart || undefined,
                expectedEnd: form.expectedEnd || undefined,
                contractDurationDays: form.contractDurationDays ? Number(form.contractDurationDays) : undefined,
                delayPenaltyRate: form.delayPenaltyRate ? Number(form.delayPenaltyRate) : undefined,
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
