'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function PayslipPage() {
  const params = useParams();
  const runId = String(params.id);
  const employeeId = String(params.employeeId);

  const payslip = useQuery({
    queryKey: ['payslip', runId, employeeId],
    queryFn: async () => {
      const res = await apiClient.get<{
        grossSalary: string;
        netSalary: string;
        employee: { arabicName: string; serial: string | null };
        payrollRun: { periodYear: number; periodMonth: number; status: string };
        components: Array<{ componentCode: string; componentType: string; amount: string }>;
      }>(`/hr/payroll/runs/${runId}/payslip/${employeeId}`);
      return res.data;
    },
  });

  if (payslip.isLoading) return <div className="p-6">جاري التحميل…</div>;
  const d = payslip.data;
  if (!d) return <div className="p-6">لا توجد قسيمة.</div>;

  const earnings = d.components.filter((c) => c.componentType === 'EARNING');
  const deductions = d.components.filter((c) => c.componentType === 'DEDUCTION');
  const employer = d.components.filter((c) => c.componentType === 'EMPLOYER_CONTRIBUTION');

  return (
    <div className="p-6 max-w-3xl" dir="rtl">
      <h2 className="text-xl font-bold mb-1">قسيمة راتب</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {d.employee.arabicName} — {d.payrollRun.periodYear}/{d.payrollRun.periodMonth} —{' '}
        {d.payrollRun.status}
      </p>
      <section className="mb-4">
        <h3 className="font-semibold">الاستحقاقات</h3>
        {earnings.map((c) => (
          <div key={c.componentCode} className="flex justify-between text-sm border-b py-1">
            <span>{c.componentCode}</span>
            <span>{Number(c.amount).toLocaleString()}</span>
          </div>
        ))}
      </section>
      <section className="mb-4">
        <h3 className="font-semibold">الاستقطاعات</h3>
        {deductions.map((c) => (
          <div key={c.componentCode} className="flex justify-between text-sm border-b py-1">
            <span>{c.componentCode}</span>
            <span>{Number(c.amount).toLocaleString()}</span>
          </div>
        ))}
      </section>
      <section className="mb-4 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground">مساهمات صاحب العمل</h3>
        {employer.map((c) => (
          <div key={c.componentCode} className="flex justify-between border-b py-1">
            <span>{c.componentCode}</span>
            <span>{Number(c.amount).toLocaleString()}</span>
          </div>
        ))}
      </section>
      <div className="flex justify-between font-bold border-t pt-2">
        <span>الإجمالي / الصافي</span>
        <span>
          {Number(d.grossSalary).toLocaleString()} / {Number(d.netSalary).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
