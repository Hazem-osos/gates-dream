'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function DeductionsPage() {
  return (
    <HrMasterLookupPage
      title="تعريف الاستقطاعات"
      queryKey="deductions"
      listPath="/hr/deductions"
      successMessage="تم حفظ الاستقطاع بنجاح"
    />
  );
}
