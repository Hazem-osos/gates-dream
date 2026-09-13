'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function MaritalStatusPage() {
  return (
    <HrMasterLookupPage
      title="الحالة الاجتماعية"
      queryKey="marital-statuses"
      listPath="/hr/marital-statuses"
      successMessage="تم حفظ الحالة الاجتماعية بنجاح"
    />
  );
}
