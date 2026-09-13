'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function ManagementsPage() {
  return (
    <HrMasterLookupPage
      title="تعريف الإدارات"
      queryKey="departments"
      listPath="/hr/departments"
      successMessage="تم حفظ الإدارة بنجاح"
      rootsOnly
    />
  );
}
