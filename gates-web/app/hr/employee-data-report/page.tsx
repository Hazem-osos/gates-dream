'use client';

import { HrEmployeePickerReportPage } from '@/components/hr/HrEmployeePickerReportPage';

export default function EmployeeDataReportPage() {
  return (
    <HrEmployeePickerReportPage
      title="تقرير بيانات الموظفين"
      emptyStateAr="سيتم عرض تقرير بيانات الموظفين هنا"
      emptyStateEn="Employee data report will be displayed here"
      previewPath="/hr/employee-data-report/preview"
      catalogUrlPath="/hr/employee-data-report"
    />
  );
}
