'use client';

import { HrEntitlementClearanceForm } from '@/components/hr/HrEntitlementClearanceForm';

export default function HousingAllowanceClearancePage() {
  return (
    <HrEntitlementClearanceForm
      title="تصفية بدل السكن"
      endpoint="/hr/housing-allowance/clear"
      procedureType="housing_allowance"
      daysLabel="عدد الأيام منذ آخر صرف"
      amountLabel="قيمة بدل السكن"
      disbursementHref="/hr/housing-allowance-entitlements-disbursement"
      buildBody={(v) => ({
        employeeId: v.employeeId,
        date: v.date,
        daysSinceLastDisbursement: v.days != null ? Math.round(v.days) : undefined,
        allowanceAmount: v.amount,
        accountId: v.accountId,
        notes: v.notes ?? undefined,
      })}
    />
  );
}
