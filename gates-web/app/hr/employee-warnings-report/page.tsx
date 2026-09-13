'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeWarningsReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير إنذارات الموظفين"
      emptyStateAr="سيتم عرض تقرير إنذارات الموظفين هنا"
      emptyStateEn="Employee warnings report will be displayed here"
      logTag="[hr/report employee-warnings]"
      catalogUrlPath="/hr/employee-warnings-report"
    />
  );
}
