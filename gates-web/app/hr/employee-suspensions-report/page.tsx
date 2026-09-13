'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeSuspensionsReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير إيقافات الموظفين"
      emptyStateAr="سيتم عرض تقرير إيقافات الموظفين هنا"
      emptyStateEn="Employee suspensions report will be displayed here"
      logTag="[hr/report employee-suspensions]"
      catalogUrlPath="/hr/employee-suspensions-report"
    />
  );
}
