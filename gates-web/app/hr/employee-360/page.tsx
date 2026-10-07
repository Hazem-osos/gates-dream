'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type EmployeeOption = { id: string; arabicName: string; serial?: string | null };

type LifecycleEvent = {
  id: string;
  eventType: string;
  effectiveDate: string;
  status: string;
  reason?: string | null;
  appliedAt?: string | null;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
};

type Employee360 = {
  profile: { id: string; arabicName: string; serial?: string | null; isActive: boolean };
  employment?: { id: string; status: string; hireDate: string; episodeNumber?: number; probationEndDate?: string | null } | null;
  attendanceSummary?: {
    scheduledMinutes: number;
    workedMinutes: number;
    absenceMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes?: number;
    detectedOvertimeMinutes: number;
    approvedOvertimeMinutes: number;
    unresolvedExceptionCount: number;
  } | null;
  attendanceDays?: Array<{
    id: string;
    logicalWorkDate: string;
    workedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    detectedOvertimeMinutes: number;
    approvedOvertimeMinutes: number;
    status: string;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    actualFirstInAt?: string | null;
    actualLastOutAt?: string | null;
  }>;
  employmentEpisodes?: Array<{
    id: string;
    episodeNumber: number;
    status: string;
    hireDate: string;
    terminationDate?: string | null;
  }>;
  currentAssignment?: {
    departmentId?: string | null;
    branchId?: string | null;
    effectiveFrom: string;
  } | null;
  assignmentHistory?: Array<{ effectiveFrom: string; effectiveTo?: string | null; changeReason?: string | null }>;
  position?: { code: string; arabicName: string } | null;
  managerPosition?: { arabicName: string } | null;
  manager?: {
    managerPositionLabel?: string | null;
    occupantEmployees?: Array<{ arabicName: string }>;
    vacant?: boolean;
  } | null;
  orgPath?: Array<{ arabicName: string; unitType: string }>;
  currentCompensation?: { basicSalary: string; fixedAllowances: string; effectiveFrom: string } | null;
  compensationHistory?: Array<{ effectiveFrom: string; effectiveTo?: string | null; basicSalary: string }>;
  lifecycleEvents?: LifecycleEvent[];
  payroll: {
    canonicalSource: string;
    history?: PayrollHistoryRow[];
    lastPostedRunItem?: { netSalary: string; grossSalary: string } | null;
  };
  leaveBalances?: Array<{ leaveTypeId: string; available: string; reserved: string; taken: string; ledgerNet: string }>;
  leaveRequests?: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    calculatedQuantity?: string | null;
    leaveType?: { arabicName: string; code: string };
  }>;
  modules: Record<string, { available: boolean; reason?: string }>;
};

type PayrollHistoryRow = {
  payrollRunId: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  paidAt?: string | null;
  grossSalary: number;
  netSalary: number;
};

type Tab = 'overview' | 'employment' | 'compensation' | 'attendance' | 'leave' | 'payroll' | 'history';

export default function Employee360Page() {
  const [employeeId, setEmployeeId] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const { data: employeesResponse } = useApiQuery<EmployeeOption[]>(
    ['employees-360-picker'],
    '/hr/employees',
    { limit: 500, isActive: true }
  );
  const employees = employeesResponse?.data ?? [];

  const { data: viewResponse, isLoading, refetch } = useApiQuery<Employee360>(
    ['employee-360', employeeId, periodStart, periodEnd],
    employeeId
      ? `/hr/employees/${employeeId}/360?attendancePeriodStart=${periodStart}&attendancePeriodEnd=${periodEnd}`
      : '',
    undefined,
    { enabled: Boolean(employeeId) }
  );
  const view = viewResponse?.data;

  return (
    <HrPageChrome title="ملف الموظف 360">
      <FormSectionCard title="اختيار الموظف">
        <select
          className={compactControlClass}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">— اختر موظفًا —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.arabicName} {emp.serial ? `(${emp.serial})` : ''}
            </option>
          ))}
        </select>
      </FormSectionCard>

      {employeeId && view && !isLoading && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {(['overview', 'employment', 'compensation', 'attendance', 'leave', 'payroll', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded border px-3 py-1 ${tab === t ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' && 'نظرة عامة'}
              {t === 'employment' && 'العمل'}
              {t === 'compensation' && 'التعويض'}
              {t === 'attendance' && 'الحضور'}
              {t === 'leave' && 'الإجازات'}
              {t === 'payroll' && 'الرواتب'}
              {t === 'history' && 'السجل'}
            </button>
          ))}
        </div>
      )}

      {employeeId && (
        <FormSectionCard title="ملف الموظف" className="mt-4">
          {isLoading ? (
            <p>جاري التحميل…</p>
          ) : view ? (
            <div className="space-y-2 text-sm">
              {tab === 'overview' && (
                <>
                  <p><strong>الاسم:</strong> {view.profile.arabicName}</p>
                  <p><strong>الحالة:</strong> {view.employment?.status ?? '—'}</p>
                  <p><strong>تاريخ التعيين:</strong> {view.employment?.hireDate?.slice(0, 10) ?? '—'}</p>
                  <p><strong>المنصب:</strong> {view.position?.arabicName ?? '—'}</p>
                  <p>
                    <strong>المسار التنظيمي:</strong>{' '}
                    {view.orgPath?.map((u) => u.arabicName).join(' › ') || '—'}
                  </p>
                  <p>
                    <strong>المدير:</strong>{' '}
                    {view.manager?.occupantEmployees?.map((e) => e.arabicName).join('، ') ||
                      view.managerPosition?.arabicName ||
                      (view.manager?.vacant ? 'شاغر' : '—')}
                  </p>
                  <p><strong>مصدر الرواتب:</strong> {view.payroll.canonicalSource}</p>
                </>
              )}
              {tab === 'employment' && (
                <>
                  <h4 className="font-medium">حلقات العمل</h4>
                  <ul className="mb-3 list-disc ps-5">
                    {(view.employmentEpisodes ?? []).map((ep) => (
                      <li key={ep.id}>
                        #{ep.episodeNumber} — {ep.status} — {ep.hireDate.slice(0, 10)}
                        {ep.terminationDate ? ` → ${ep.terminationDate.slice(0, 10)}` : ' (حالي)'}
                      </li>
                    ))}
                  </ul>
                  <p><strong>حالة العمل:</strong> {view.employment?.status ?? '—'}</p>
                  <p><strong>التعيين الحالي من:</strong> {view.currentAssignment?.effectiveFrom?.slice(0, 10) ?? '—'}</p>
                  <p><strong>المنصب:</strong> {view.position ? `${view.position.code} — ${view.position.arabicName}` : '—'}</p>
                  <h4 className="mt-3 font-medium">تاريخ التعيينات</h4>
                  <ul className="list-disc ps-5">
                    {(view.assignmentHistory ?? []).map((a, i) => (
                      <li key={i}>
                        {a.effectiveFrom.slice(0, 10)} → {a.effectiveTo?.slice(0, 10) ?? 'مفتوح'}{' '}
                        {a.changeReason ? `(${a.changeReason})` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {tab === 'attendance' && (
                <>
                  {!view.modules.attendance?.available ? (
                    <p className="text-muted-foreground">الحضور غير متاح.</p>
                  ) : !view.attendanceSummary ? (
                    <p className="text-muted-foreground">لا صلاحية عرض الحضور أو لا توجد بيانات.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <input type="date" className={compactControlClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                        <input type="date" className={compactControlClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
                        <div className="border rounded p-2">عمل: {(view.attendanceSummary.workedMinutes / 60).toFixed(1)} س</div>
                        <div className="border rounded p-2">تأخير: {view.attendanceSummary.lateMinutes} د</div>
                        <div className="border rounded p-2">انصراف مبكر: {view.attendanceSummary.earlyLeaveMinutes ?? 0} د</div>
                        <div className="border rounded p-2">إضافي معتمد: {view.attendanceSummary.approvedOvertimeMinutes} د</div>
                        <div className="border rounded p-2">إضافي مكتشف: {view.attendanceSummary.detectedOvertimeMinutes} د</div>
                        <div className="border rounded p-2">غياب: {view.attendanceSummary.absenceMinutes} د</div>
                        <div className="border rounded p-2">استثناءات: {view.attendanceSummary.unresolvedExceptionCount}</div>
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="p-1">اليوم</th>
                            <th>دخول</th>
                            <th>خروج</th>
                            <th>عمل</th>
                            <th>تأخير</th>
                            <th>مبكر</th>
                            <th>إضافي</th>
                            <th>الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(view.attendanceDays ?? []).map((d) => (
                            <tr key={d.id} className="border-b">
                              <td className="p-1">{d.logicalWorkDate.slice(0, 10)}</td>
                              <td>{d.actualFirstInAt?.slice(11, 16) ?? '—'}</td>
                              <td>{d.actualLastOutAt?.slice(11, 16) ?? '—'}</td>
                              <td>{d.workedMinutes}</td>
                              <td>{d.lateMinutes}</td>
                              <td>{d.earlyLeaveMinutes}</td>
                              <td>{d.approvedOvertimeMinutes}/{d.detectedOvertimeMinutes}</td>
                              <td>{d.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
              {tab === 'leave' && (
                <FormSectionCard title="الإجازات">
                  {!view.modules.leave?.available ? (
                    <p className="text-sm text-muted-foreground">غير متاح</p>
                  ) : (
                    <>
                      <div className="grid gap-2 sm:grid-cols-3 text-xs mb-4">
                        {(view.leaveBalances ?? []).map((b) => (
                          <div key={b.leaveTypeId} className="border rounded p-2">
                            متاح: {b.available} — محجوز: {b.reserved} — مستخدم: {b.taken}
                          </div>
                        ))}
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="p-1 text-right">النوع</th>
                            <th className="p-1 text-right">من</th>
                            <th className="p-1 text-right">إلى</th>
                            <th className="p-1 text-right">الأيام</th>
                            <th className="p-1 text-right">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(view.leaveRequests ?? []).map((r) => (
                            <tr key={r.id} className="border-b">
                              <td className="p-1">{r.leaveType?.arabicName}</td>
                              <td className="p-1">{r.startDate.slice(0, 10)}</td>
                              <td className="p-1">{r.endDate.slice(0, 10)}</td>
                              <td className="p-1">{r.calculatedQuantity ?? '—'}</td>
                              <td className="p-1">{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </FormSectionCard>
              )}
              {tab === 'compensation' && (
                <>
                  {view.currentCompensation ? (
                    <p>
                      <strong>الراتب الحالي:</strong> {view.currentCompensation.basicSalary} من{' '}
                      {view.currentCompensation.effectiveFrom?.slice(0, 10)}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">التعويض غير متاح (صلاحيات أو لا يوجد سجل HCM).</p>
                  )}
                  <h4 className="mt-3 font-medium">السجل</h4>
                  <ul className="list-disc ps-5">
                    {(view.compensationHistory ?? []).map((c, i) => (
                      <li key={i}>
                        {c.basicSalary} — {c.effectiveFrom.slice(0, 10)} → {c.effectiveTo?.slice(0, 10) ?? 'مفتوح'}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {tab === 'payroll' && (
                <FormSectionCard title="مسيرات الرواتب (PayrollRun)">
                  <p className="text-xs text-muted-foreground mb-2">المصدر: {view.payroll.canonicalSource}</p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="p-1 text-right">الفترة</th>
                        <th className="p-1 text-right">الإجمالي</th>
                        <th className="p-1 text-right">الصافي</th>
                        <th className="p-1 text-right">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(view.payroll.history ?? []).map((row) => (
                        <tr key={row.payrollRunId} className="border-b">
                          <td className="p-1">{row.periodYear}-{String(row.periodMonth).padStart(2, '0')}</td>
                          <td className="p-1">{row.grossSalary.toLocaleString()}</td>
                          <td className="p-1">{row.netSalary.toLocaleString()}</td>
                          <td className="p-1">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(view.payroll.history ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">لا توجد مسيرات بعد.</p>
                  )}
                </FormSectionCard>
              )}
              {tab === 'history' && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view.lifecycleEvents ?? []).map((ev) => (
                      <tr key={ev.id} className="border-t">
                        <td>{ev.effectiveDate.slice(0, 10)}</td>
                        <td>{ev.eventType}</td>
                        <td>{ev.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button type="button" className="text-primary underline" onClick={() => refetch()}>
                تحديث
              </button>
            </div>
          ) : (
            <p>لا توجد بيانات.</p>
          )}
        </FormSectionCard>
      )}
    </HrPageChrome>
  );
}
