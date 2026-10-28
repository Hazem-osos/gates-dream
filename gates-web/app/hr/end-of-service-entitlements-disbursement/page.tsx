'use client';

import { HrEntitlementDisbursementForm } from '@/components/hr/HrEntitlementDisbursementForm';

export default function EndOfServiceEntitlementsDisbursementPage() {
  return (
    <HrEntitlementDisbursementForm
      title="صرف مستحقات نهاية الخدمة"
      endpoint="/hr/eos-disbursements"
      clearanceHref="/hr/end-of-service-entitlements-clearance"
    />
  );
}
