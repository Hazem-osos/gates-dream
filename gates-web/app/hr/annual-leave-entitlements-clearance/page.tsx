'use client';

import { HrEntitlementClearanceForm } from '@/components/hr/HrEntitlementClearanceForm';

export default function AnnualLeaveEntitlementsClearancePage() {
  return (
    <HrEntitlementClearanceForm
      title="تصفية مستحقات الإجازة السنوية"
      endpoint="/hr/leave-entitlements/clear"
      procedureType="annual_leave_clearance"
      daysLabel="أيام الإجازة المستحقة"
      amountLabel="قيمة مستحقات الإجازة"
      disbursementHref="/hr/annual-leave-entitlements-disbursement"
      buildBody={(v) => ({
        employeeId: v.employeeId,
        date: v.date,
        year: Number(v.date.slice(0, 4)),
        days: v.days,
        amount: v.amount,
        accountId: v.accountId,
        notes: v.notes,
      })}
    />
  );
}
