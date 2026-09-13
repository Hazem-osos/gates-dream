'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function JobTitlesPage() {
  return (
    <HrMasterLookupPage
      title="المسميات الوظيفية"
      queryKey="job-titles"
      listPath="/hr/job-titles"
      successMessage="تم حفظ المسمى الوظيفي بنجاح"
    />
  );
}
