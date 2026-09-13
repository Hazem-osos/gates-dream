'use client';

import { HrEmployeePickerReportPage } from '@/components/hr/HrEmployeePickerReportPage';

export default function EndOfServiceReportPage() {
  return (
    <HrEmployeePickerReportPage
      title="تقرير صرف مستحقات نهاية الخدمة"
      emptyStateAr="سيتم عرض تقرير صرف مستحقات نهاية الخدمة هنا"
      emptyStateEn="End of service entitlements report will be displayed here"
      previewPath="/hr/end-of-service-report/preview"
      catalogUrlPath="/hr/end-of-service-report"
    />
  );
}
