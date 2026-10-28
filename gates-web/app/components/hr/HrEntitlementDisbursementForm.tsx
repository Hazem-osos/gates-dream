'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { HrEmployeeSelect } from '@/components/hr/HrEmployeeSelect';
import {
  HrPaymentSourcePicker,
  paymentSourceBody,
  type HrPaymentSource,
} from '@/components/hr/HrPaymentSourcePicker';
import { FormSectionCard } from '@/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { invalidateTreasuryFundBalances } from '@/lib/hooks/useMasterDataQueries';
import { toast } from '@/lib/feedback/toast';

type DisbursementRow = {
  id: string;
  date: string;
  amount: number | string;
  paymentMethod?: string | null;
  notes?: string | null;
  serial?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Entitlement payout (صرف): saves the disbursement and posts
 * Dr accrued payroll / Cr safe-or-bank on the server, in one transaction.
 * Cancel reverses that journal.
 */
export function HrEntitlementDisbursementForm({
  title,
  endpoint,
  clearanceHref,
}: {
  title: string;
  endpoint: string;
  clearanceHref?: string;
}) {
  const invalidate = useInvalidateQuery();
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<HrPaymentSource>({ kind: 'safe', id: '' });
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const listKey = ['hr-disbursements', endpoint, employeeId];
  const list = useApiQuery<DisbursementRow[]>(listKey, endpoint, { employeeId }, { enabled: Boolean(employeeId) });

  const refresh = () => {
    invalidate(listKey);
    invalidateTreasuryFundBalances(invalidate);
  };

  const reset = () => {
    setAmount('');
    setSerial('');
    setNotes('');
    setError('');
    setDate(today());
  };

  const save = async () => {
    setError('');
    const value = Number(amount);
    if (!employeeId) return setError('اختر الموظف');
    if (!(value > 0)) return setError('أدخل قيمة أكبر من صفر');
    if (!source.id) return setError(source.kind === 'safe' ? 'اختر الخزينة' : 'اختر الحساب البنكي');
    setSaving(true);
    try {
      await apiClient.post(endpoint, {
        employeeId,
        date,
        amount: value,
        serial: serial.trim() || undefined,
        notes: notes.trim() || null,
        ...paymentSourceBody(source),
      });
      toast.success('تم الصرف وترحيل القيد');
      refresh();
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الصرف');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('إلغاء الصرف سيعكس قيد الصرف ويعيد المبلغ للخزينة/البنك. متابعة؟')) return;
    setCancellingId(id);
    try {
      await apiClient.post(`${endpoint}/${id}/cancel`, {});
      toast.success('تم إلغاء الصرف وعكس القيد');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الإلغاء');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <HrPageChrome title={title} onSave={() => void save()} onNew={reset} savePending={saving}>
      <FormSectionCard title="بيانات الصرف">
        <div className="col-span-full grid gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">الموظف</span>
            <HrEmployeeSelect value={employeeId} onChange={(id) => setEmployeeId(id)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">التاريخ</span>
            <input type="date" className={compactControlClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">المسلسل (اختياري)</span>
            <input className={compactControlClass} value={serial} onChange={(e) => setSerial(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">المبلغ</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={compactControlClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="space-y-1">
            <span className="text-sm text-slate-700">الصرف من</span>
            <HrPaymentSourcePicker value={source} onChange={setSource} />
          </div>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">ملاحظات</span>
            <textarea rows={3} className={compactControlClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
          <p className="text-xs text-slate-500 md:col-span-2">
            الحفظ يرحّل قيد صرف: مدين مستحقات الرواتب / دائن الخزينة أو البنك.
            {clearanceHref ? (
              <>
                {' '}
                يجب أن تكون المستحقات مصفّاة أولاً من{' '}
                <a className="text-brand underline" href={clearanceHref}>
                  شاشة التصفية
                </a>
                .
              </>
            ) : null}
          </p>
        </div>
      </FormSectionCard>

      {employeeId ? (
        <FormSectionCard title="عمليات الصرف للموظف">
          <div className="col-span-full overflow-x-auto">
            {(list.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد عمليات صرف</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">المبلغ</th>
                    <th className="p-2 text-right">من</th>
                    <th className="p-2 text-right">ملاحظات</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{String(row.date).slice(0, 10)}</td>
                      <td className="p-2">{Number(row.amount).toLocaleString('ar-EG')}</td>
                      <td className="p-2">{row.paymentMethod === 'bank' ? 'بنك' : 'خزينة'}</td>
                      <td className="p-2">{row.notes}</td>
                      <td className="p-2 text-left">
                        <button
                          type="button"
                          className="text-xs text-red-600 underline disabled:opacity-50"
                          disabled={cancellingId === row.id}
                          onClick={() => void cancel(row.id)}
                        >
                          إلغاء الصرف
                        </button>
                      </td>
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
