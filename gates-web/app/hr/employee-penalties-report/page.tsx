'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeePenaltiesReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير جزاءات الموظفين"
      emptyStateAr="سيتم عرض تقرير جزاءات الموظفين هنا"
      emptyStateEn="Employee penalties report will be displayed here"
      logTag="[hr/report employee-penalties]"
      catalogUrlPath="/hr/employee-penalties-report"
    />
  );
}
