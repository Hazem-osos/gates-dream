'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { ErpFormHeaderCard, erpInputClass, erpLabelClass } from '@/components/erp';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import { cn } from '@/lib/utils';
import { dateControlClass } from '@/app/components/ui/forms/formTokens';

type CustomerRow = { id: string; arabicName: string };

function todayLocalDateOnly(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function NewTenderPage() {
  const router = useRouter();
  const customersQ = useApiQuery<CustomerRow[]>(['tender-new-customers'], '/accounting/customers', { limit: 500 });
  const create = useApiMutation<{ id: string }, Record<string, unknown>>('/contracting/tenders', 'POST');

  const [form, setForm] = useState({
    tenderNumber: '',
    customerId: '',
    nameAr: '',
    description: '',
    currencyCode: 'EGP',
    consultantName: '',
    projectManagerName: '',
    fundingSource: '',
    location: '',
    issueDate: todayLocalDateOnly(),
    expectedStart: '',
    expectedEnd: '',
    contractDurationDays: '',
    delayPenaltyRate: '',
  });

  const customers = customersQ.data?.data ?? [];
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    if (!form.customerId || !form.nameAr.trim() || create.isPending) return;
    const res = await create.mutateAsync({
      customerId: form.customerId,
      nameAr: form.nameAr.trim(),
      tenderNumber: form.tenderNumber.trim() || undefined,
      currencyCode: form.currencyCode.trim() || 'EGP',
      description: form.description.trim() || undefined,
      consultantName: form.consultantName.trim() || undefined,
      projectManagerName: form.projectManagerName.trim() || undefined,
      fundingSource: form.fundingSource.trim() || undefined,
      location: form.location.trim() || undefined,
      issueDate: form.issueDate || undefined,
      expectedStart: form.expectedStart || undefined,
      expectedEnd: form.expectedEnd || undefined,
      contractDurationDays: form.contractDurationDays ? Number(form.contractDurationDays) : undefined,
      delayPenaltyRate: form.delayPenaltyRate ? Number(form.delayPenaltyRate) : undefined,
    });
    const id = res.data?.id;
    if (id) router.push(`/contracting/tenders/${id}`);
  };

  return (
    <ExtractsPageChrome
      title="عطاء جديد"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { href: '/contracting/tenders', label: 'العطاءات' },
        { label: 'جديد' },
      ]}
      statusLabel="جديد"
      favoriteHref="/contracting/tenders/new"
      onNew={() => router.push('/contracting/tenders/new')}
      onSave={save}
      savePending={create.isPending}
      canSave={Boolean(form.customerId && form.nameAr.trim())}
      saveLabel="إنشاء العطاء"
    >
      {customersQ.isLoading ? <p className="text-sm text-muted-foreground">جاري تحميل العملاء…</p> : null}
      {customersQ.isError ? (
        <p className="text-sm text-destructive">تعذر تحميل قائمة العملاء. حاول مرة أخرى.</p>
      ) : null}
      <ErpFormHeaderCard
        row1={
          <>
            <div>
              <label className={erpLabelClass}>رقم العطاء</label>
              <input className={erpInputClass} value={form.tenderNumber} onChange={set('tenderNumber')} maxLength={32} placeholder="تلقائي إن تُرك فارغاً" />
            </div>
            <div>
              <label className={erpLabelClass}>تاريخ التحرير</label>
              <input type="date" className={cn(erpInputClass, dateControlClass)} value={form.issueDate} onChange={set('issueDate')} />
            </div>
            <div>
              <label className={erpLabelClass}>المالك / العميل</label>
              <select className={erpInputClass} value={form.customerId} onChange={set('customerId')}>
                <option value="">— اختر المالك —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.arabicName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={erpLabelClass}>اسم العطاء</label>
              <input className={erpInputClass} value={form.nameAr} onChange={set('nameAr')} />
            </div>
          </>
        }
        row2={
          <>
            <div>
              <label className={erpLabelClass}>الاستشاري</label>
              <input className={erpInputClass} value={form.consultantName} onChange={set('consultantName')} />
            </div>
            <div>
              <label className={erpLabelClass}>مدير المشروع</label>
              <input className={erpInputClass} value={form.projectManagerName} onChange={set('projectManagerName')} />
            </div>
            <div>
              <label className={erpLabelClass}>مصدر التمويل</label>
              <input className={erpInputClass} value={form.fundingSource} onChange={set('fundingSource')} />
            </div>
            <div>
              <label className={erpLabelClass}>موقع المشروع</label>
              <input className={erpInputClass} value={form.location} onChange={set('location')} />
            </div>
          </>
        }
        extras={
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={erpLabelClass}>العملة</label>
              <input className={erpInputClass} value={form.currencyCode} onChange={set('currencyCode')} />
            </div>
            <div>
              <label className={erpLabelClass}>بداية المشروع</label>
              <input type="date" className={cn(erpInputClass, dateControlClass)} value={form.expectedStart} onChange={set('expectedStart')} />
            </div>
            <div>
              <label className={erpLabelClass}>نهاية المشروع</label>
              <input type="date" className={cn(erpInputClass, dateControlClass)} value={form.expectedEnd} onChange={set('expectedEnd')} />
            </div>
            <div>
              <label className={erpLabelClass}>مدة العقد (يوم)</label>
              <input type="number" className={erpInputClass} value={form.contractDurationDays} onChange={set('contractDurationDays')} />
            </div>
            <div>
              <label className={erpLabelClass}>غرامة التأخير (0.01 = 1%)</label>
              <input type="number" step="0.0001" className={erpInputClass} value={form.delayPenaltyRate} onChange={set('delayPenaltyRate')} />
            </div>
            <div className="sm:col-span-4">
              <label className={erpLabelClass}>ملاحظات / وصف</label>
              <textarea className={cn(erpInputClass, 'h-auto min-h-[72px] py-2')} rows={3} value={form.description} onChange={set('description')} />
            </div>
          </div>
        }
        extrasLabel="تواريخ العقد والملاحظات"
      />
    </ExtractsPageChrome>
  );
}
