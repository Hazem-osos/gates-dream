'use client';

import { HrMasterLookupPage } from '@/components/hr/HrMasterLookupPage';

export default function CitiesPage() {
  return (
    <HrMasterLookupPage
      title="تعريف المدن"
      queryKey="cities"
      listPath="/hr/cities"
      successMessage="تم حفظ المدينة بنجاح"
    />
  );
}
