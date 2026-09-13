'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeSecondmentReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير إنتداب الموظفين"
      emptyStateAr="سيتم عرض تقرير إنتداب الموظفين هنا"
      emptyStateEn="Employee secondment report will be displayed here"
      logTag="[hr/report employee-secondment]"
      catalogUrlPath="/hr/employee-secondment-report"
    />
  );
}
