'use client';

import { HrEntitlementDisbursementForm } from '@/components/hr/HrEntitlementDisbursementForm';

export default function AnnualLeaveEntitlementsDisbursementPage() {
  return (
    <HrEntitlementDisbursementForm
      title="صرف مستحقات الإجازة السنوية"
      endpoint="/hr/annual-leave-disbursements"
      clearanceHref="/hr/annual-leave-entitlements-clearance"
    />
  );
}
