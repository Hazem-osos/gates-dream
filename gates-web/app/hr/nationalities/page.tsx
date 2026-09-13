'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function NationalitiesPage() {
  return (
    <HrMasterLookupPage
      title="تعريف الجنسيات"
      queryKey="nationalities"
      listPath="/hr/nationalities"
      successMessage="تم حفظ الجنسية بنجاح"
    />
  );
}
