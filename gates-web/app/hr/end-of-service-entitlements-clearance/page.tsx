'use client';

import { HrEntitlementClearanceForm } from '@/components/hr/HrEntitlementClearanceForm';

export default function EndOfServiceEntitlementsClearancePage() {
  return (
    <HrEntitlementClearanceForm
      title="تصفية مستحقات نهاية الخدمة"
      endpoint="/hr/eos-clearance/clear"
      procedureType="eos_clearance"
      daysLabel="الأيام المستحقة"
      amountLabel="قيمة مستحقات نهاية الخدمة"
      disbursementHref="/hr/end-of-service-entitlements-disbursement"
      buildBody={(v) => ({
        employeeId: v.employeeId,
        date: v.date,
        dueDays: v.days ?? undefined,
        eosAmount: v.amount,
        accountId: v.accountId,
        notes: v.notes ?? undefined,
      })}
    />
  );
}
