'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function AllowancesPage() {
  return (
    <HrMasterLookupPage
      title="تعريف الإضافات"
      queryKey="allowances"
      listPath="/hr/allowances"
      successMessage="تم حفظ الإضافة بنجاح"
    />
  );
}
