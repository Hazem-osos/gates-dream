'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeCoursesReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير دورات الموظفين"
      emptyStateAr="سيتم عرض تقرير دورات الموظفين هنا"
      emptyStateEn="Employee courses report will be displayed here"
      logTag="[hr/report employee-courses]"
      catalogUrlPath="/hr/employee-courses-report"
    />
  );
}
