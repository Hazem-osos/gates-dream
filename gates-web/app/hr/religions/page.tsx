'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function ReligionsPage() {
  return (
    <HrMasterLookupPage
      title="تعريف الديانات"
      queryKey="religions"
      listPath="/hr/religions"
      successMessage="تم حفظ الديانة بنجاح"
    />
  );
}
