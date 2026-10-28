'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { HrEmployeeSelect, type HrEmployeeOption } from '@/components/hr/HrEmployeeSelect';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { FormSectionCard } from '@/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';

export type ClearanceValues = {
  employeeId: string;
  date: string;
  days: number | null;
  amount: number;
  accountId: string | null;
  notes: string | null;
};

type ProcedureRow = {
  id: string;
  date: string;
  amount?: number | string | null;
  description?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Entitlement clearance (تصفية): records the document and posts the accrual
 * journal (Dr expense / Cr accrued payroll) on the server. The payout is the
 * matching disbursement screen.
 */
export function HrEntitlementClearanceForm({
  title,
  endpoint,
  procedureType,
  buildBody,
  daysLabel = 'عدد الأيام المستحقة',
  amountLabel = 'قيمة المستحقات',
  disbursementHref,
}: {
  title: string;
  endpoint: string;
  procedureType: string;
  buildBody: (values: ClearanceValues) => Record<string, unknown>;
  daysLabel?: string;
  amountLabel?: string;
  disbursementHref?: string;
}) {
  const invalidate = useInvalidateQuery();
  const [employee, setEmployee] = useState<HrEmployeeOption | undefined>();
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(today());
  const [days, setDays] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const historyKey = ['hr-clearance-history', procedureType, employeeId];
  const history = useApiQuery<ProcedureRow[]>(
    historyKey,
    '/hr/employee-procedures',
    { employeeId, procedureType, limit: 50 },
    { enabled: Boolean(employeeId) }
  );

  const salary = Number(employee?.basicSalary ?? 0);
  const dayCount = Number(days);
  const suggested = salary > 0 && dayCount > 0 ? Math.round(((salary / 30) * dayCount) * 100) / 100 : null;

  const reset = () => {
    setDays('');
    setAmount('');
    setNotes('');
    setError('');
    setDate(today());
  };

  const save = async () => {
    setError('');
    const value = Number(amount);
    if (!employeeId) return setError('اختر الموظف');
    if (!date) return setError('أدخل التاريخ');
    if (!(value > 0)) return setError('أدخل قيمة أكبر من صفر');
    setSaving(true);
    try {
      await apiClient.post(
        endpoint,
        buildBody({
          employeeId,
          date,
          days: days ? dayCount : null,
          amount: value,
          accountId: accountId || null,
          notes: notes.trim() || null,
        })
      );
      toast.success('تمت التصفية وترحيل القيد');
      invalidate(historyKey);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrPageChrome title={title} onSave={() => void save()} onNew={reset} savePending={saving}>
      <FormSectionCard title="بيانات التصفية">
        <div className="col-span-full grid gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">الموظف</span>
            <HrEmployeeSelect
              value={employeeId}
              onChange={(id, emp) => {
                setEmployeeId(id);
                setEmployee(emp);
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">التاريخ</span>
            <input type="date" className={compactControlClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">{daysLabel}</span>
            <input
              type="number"
              min={0}
              step="0.5"
              className={compactControlClass}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">{amountLabel}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={compactControlClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {suggested != null ? (
              <button type="button" className="text-xs text-brand underline" onClick={() => setAmount(String(suggested))}>
                القيمة المقترحة: {suggested.toLocaleString('ar-EG')} (الراتب الأساسي ÷ 30 × الأيام)
              </button>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">حساب المصروف (اختياري — الافتراضي من إعدادات الموارد البشرية)</span>
            <AccountSelect value={accountId} onChange={setAccountId} statementType="INCOME_STATEMENT" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">ملاحظات</span>
            <textarea rows={3} className={compactControlClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
          <p className="text-xs text-slate-500 md:col-span-2">
            الحفظ يرحّل قيد استحقاق: مدين حساب المصروف / دائن مستحقات الرواتب.
            {disbursementHref ? (
              <>
                {' '}
                الصرف الفعلي من شاشة{' '}
                <a className="text-brand underline" href={disbursementHref}>
                  الصرف
                </a>
                .
              </>
            ) : null}
          </p>
        </div>
      </FormSectionCard>

      {employeeId ? (
        <FormSectionCard title="التصفيات السابقة للموظف">
          <div className="col-span-full">
            {(history.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد تصفيات سابقة</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">القيمة</th>
                    <th className="p-2 text-right">البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {(history.data?.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{String(row.date).slice(0, 10)}</td>
                      <td className="p-2">{Number(row.amount ?? 0).toLocaleString('ar-EG')}</td>
                      <td className="p-2">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </FormSectionCard>
      ) : null}
    </HrPageChrome>
  );
}
