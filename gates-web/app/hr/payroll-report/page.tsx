'use client';

import { HrEmployeePickerReportPage } from '@/components/hr/HrEmployeePickerReportPage';

export default function PayrollReportPage() {
  return (
    <HrEmployeePickerReportPage
      title="تقرير الرواتب"
      emptyStateAr="اختر الفترة ثم اعرض التقرير"
      emptyStateEn=""
      previewPath="/hr/payroll-report/preview"
      catalogUrlPath="/hr/payroll-report"
    />
  );
}
