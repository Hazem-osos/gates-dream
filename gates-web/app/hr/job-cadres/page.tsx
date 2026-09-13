'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function JobCadresPage() {
  return (
    <HrMasterLookupPage
      title="الكادرات الوظيفية"
      queryKey="job-cadres"
      listPath="/hr/job-cadres"
      successMessage="تم حفظ الكادر الوظيفي بنجاح"
    />
  );
}
