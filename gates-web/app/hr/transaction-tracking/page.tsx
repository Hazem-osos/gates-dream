'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { HrEmployeeSelect } from '@/components/hr/HrEmployeeSelect';
import { FormSectionCard } from '@/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { useApiQuery } from '@/lib/hooks/useApi';

interface EmployeeProcedureRow {
  id: string;
  serial?: string | null;
  procedureType: string;
  date: string;
  amount?: number | string | null;
  description?: string | null;
  reason?: string | null;
  employee?: { arabicName?: string | null; serial?: string | null; employeeId?: string | null };
}

const PROCEDURE_TYPE_AR: Record<string, string> = {
  warning: 'إنذار',
  reward: 'مكافأة',
  penalty: 'جزاء',
  transfer: 'نقل',
  promotion: 'ترقية',
  demotion: 'تخفيض درجة',
  suspension: 'إيقاف خدمة',
  termination: 'إنهاء خدمة',
  reinstatement: 'إعادة مباشرة',
  onboarding: 'مباشرة عمل',
  secondment: 'انتداب',
  training: 'دورة تدريبية',
  eos_clearance: 'تصفية نهاية خدمة',
  housing_allowance: 'تصفية بدل سكن',
  annual_leave_clearance: 'تصفية إجازة سنوية',
  leave_entitlement: 'مستحقات إجازة (قديم)',
  other: 'تزكية / أخرى',
};

type Filters = { employeeId: string; procedureType: string; startDate: string; endDate: string };

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionTrackingPage() {
  const [draft, setDraft] = useState<Filters>({
    employeeId: '',
    procedureType: '',
    startDate: firstOfYear(),
    endDate: today(),
  });
  const [applied, setApplied] = useState<Filters>(draft);

  const { data, isFetching } = useApiQuery<EmployeeProcedureRow[]>(
    ['hr-employee-procedures', 'tracking', applied],
    '/hr/employee-procedures',
    {
      limit: 200,
      employeeId: applied.employeeId || undefined,
      procedureType: applied.procedureType || undefined,
      startDate: applied.startDate || undefined,
      endDate: applied.endDate || undefined,
    }
  );
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="متابعة المعاملات" statusLabel="استعلام" onSave={() => setApplied(draft)} canSave>
      <FormSectionCard title="بحث">
        <div className="col-span-full grid gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">الموظف (اختياري)</span>
            <HrEmployeeSelect value={draft.employeeId} onChange={(id) => setDraft((d) => ({ ...d, employeeId: id }))} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">نوع المعاملة</span>
            <select
              className={compactControlClass}
              value={draft.procedureType}
              onChange={(e) => setDraft((d) => ({ ...d, procedureType: e.target.value }))}
            >
              <option value="">الكل</option>
              {Object.entries(PROCEDURE_TYPE_AR).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-sm text-slate-700">من تاريخ</span>
              <input
                type="date"
                className={compactControlClass}
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-700">إلى تاريخ</span>
              <input
                type="date"
                className={compactControlClass}
                value={draft.endDate}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              />
            </label>
          </div>
          <div className="md:col-span-2">
            <button type="button" className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white" onClick={() => setApplied(draft)}>
              بحث
            </button>
          </div>
        </div>
      </FormSectionCard>

      <FormSectionCard title={`المعاملات (${rows.length})`}>
        <div className="col-span-full overflow-x-auto">
          {isFetching ? (
            <p className="text-sm text-slate-500">جاري التحميل…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد معاملات مطابقة</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">الموظف</th>
                  <th className="p-2 text-right">نوع المعاملة</th>
                  <th className="p-2 text-right">المسلسل</th>
                  <th className="p-2 text-right">القيمة</th>
                  <th className="p-2 text-right">البيان</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{String(row.date).slice(0, 10)}</td>
                    <td className="p-2">{row.employee?.arabicName ?? '—'}</td>
                    <td className="p-2">{PROCEDURE_TYPE_AR[row.procedureType] ?? row.procedureType}</td>
                    <td className="p-2">{row.serial ?? '—'}</td>
                    <td className="p-2">{row.amount != null ? Number(row.amount).toLocaleString('ar-EG') : '—'}</td>
                    <td className="p-2">{row.description ?? row.reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </FormSectionCard>
    </HrPageChrome>
  );
}
