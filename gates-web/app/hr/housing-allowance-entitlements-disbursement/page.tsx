'use client';

import { HrEntitlementDisbursementForm } from '@/components/hr/HrEntitlementDisbursementForm';

export default function HousingAllowanceEntitlementsDisbursementPage() {
  return (
    <HrEntitlementDisbursementForm
      title="صرف مستحقات بدل السكن"
      endpoint="/hr/housing-allowance-disbursements"
      clearanceHref="/hr/housing-allowance-clearance"
    />
  );
}
