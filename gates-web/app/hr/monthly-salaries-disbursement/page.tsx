'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { HrPaymentSourcePicker, paymentSourceBody, type HrPaymentSource } from '@/components/hr/HrPaymentSourcePicker';
import { FormSectionCard } from '@/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { invalidateTreasuryFundBalances } from '@/lib/hooks/useMasterDataQueries';
import { useInvalidateQuery } from '@/lib/hooks/useApi';

type RunRow = {
  id: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  employeeCount: number;
  gross: number | null;
  net: number | null;
};

const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  CALCULATED: 'محسوبة',
  REVIEWED: 'تمت المراجعة',
  APPROVED: 'معتمدة',
  POSTED: 'مرحّلة — جاهزة للصرف',
  PAID: 'مصروفة',
  CANCELLED: 'ملغاة',
};

/**
 * صرف الرواتب الشهرية — pays a posted payroll run from a safe or bank
 * (POST /hr/payroll-runs/:id/disburse → Dr accrued payroll / Cr cash).
 */
export default function MonthlySalariesDisbursementPage() {
  const qc = useQueryClient();
  const invalidate = useInvalidateQuery();
  const [year, setYear] = useState(new Date().getFullYear());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [source, setSource] = useState<HrPaymentSource>({ kind: 'safe', id: '' });

  const runs = useQuery({
    queryKey: ['payroll-runs-list', year, 'disbursement'],
    queryFn: async () => {
      const res = await apiClient.get<{ rows: RunRow[]; total: number }>(
        `/hr/payroll/runs?periodYear=${year}&page=1&pageSize=24`
      );
      return res.data;
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['payroll-runs-list'] });
    invalidateTreasuryFundBalances(invalidate);
  };

  const disburse = useMutation({
    mutationFn: (runId: string) => apiClient.post(`/hr/payroll-runs/${runId}/disburse`, paymentSourceBody(source)),
    onSuccess: () => {
      toast.success('تم صرف الرواتب وترحيل قيد الصرف');
      setPayingId(null);
      refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'تعذر الصرف'),
  });

  const unpay = useMutation({
    mutationFn: (runId: string) => apiClient.post(`/hr/payroll-runs/${runId}/unpost-disbursement`, {}),
    onSuccess: () => {
      toast.success('تم عكس قيد الصرف');
      refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'تعذر عكس الصرف'),
  });

  const rows = runs.data?.rows ?? [];
  const thisYear = new Date().getFullYear();

  return (
    <HrPageChrome title="صرف الرواتب الشهرية للموظفين" statusLabel="صرف">
      <FormSectionCard title="مسيرات الرواتب">
        <div className="col-span-full space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-700">السنة</label>
            <select className={`${compactControlClass} w-32`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Link className="text-sm text-brand underline" href="/hr/payroll/runs">
              حساب واعتماد المسيرات
            </Link>
          </div>

          {runs.isLoading ? (
            <p className="text-sm text-slate-500">جاري التحميل…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد مسيرات رواتب لهذه السنة. احسب المسيرة واعتمدها ثم رحّلها أولاً.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2 text-right">الشهر</th>
                    <th className="p-2 text-right">عدد الموظفين</th>
                    <th className="p-2 text-right">الصافي</th>
                    <th className="p-2 text-right">الحالة</th>
                    <th className="p-2 text-right">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-2">
                        <Link className="underline" href={`/hr/payroll/runs/${r.id}`}>
                          {r.periodYear}-{String(r.periodMonth).padStart(2, '0')}
                        </Link>
                      </td>
                      <td className="p-2">{r.employeeCount}</td>
                      <td className="p-2">{r.net?.toLocaleString('ar-EG') ?? '—'}</td>
                      <td className="p-2">{STATUS_AR[r.status] ?? r.status}</td>
                      <td className="p-2">
                        {r.status === 'POSTED' && payingId !== r.id ? (
                          <button
                            type="button"
                            className="rounded bg-brand px-3 py-1 text-xs text-white"
                            onClick={() => {
                              setPayingId(r.id);
                              setSource({ kind: 'safe', id: '' });
                            }}
                          >
                            صرف
                          </button>
                        ) : null}
                        {r.status === 'POSTED' && payingId === r.id ? (
                          <div className="max-w-xs space-y-2">
                            <HrPaymentSourcePicker value={source} onChange={setSource} />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded bg-brand px-3 py-1 text-xs text-white disabled:opacity-50"
                                disabled={!source.id || disburse.isPending}
                                onClick={() => disburse.mutate(r.id)}
                              >
                                تأكيد صرف {r.net?.toLocaleString('ar-EG') ?? ''}
                              </button>
                              <button type="button" className="text-xs underline" onClick={() => setPayingId(null)}>
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {r.status === 'PAID' ? (
                          <button
                            type="button"
                            className="text-xs text-red-600 underline disabled:opacity-50"
                            disabled={unpay.isPending}
                            onClick={() => {
                              if (window.confirm('عكس صرف هذه المسيرة؟')) unpay.mutate(r.id);
                            }}
                          >
                            عكس الصرف
                          </button>
                        ) : null}
                        {!['POSTED', 'PAID'].includes(r.status) ? (
                          <span className="text-xs text-slate-500">يجب ترحيل المسيرة قبل الصرف</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FormSectionCard>
    </HrPageChrome>
  );
}
