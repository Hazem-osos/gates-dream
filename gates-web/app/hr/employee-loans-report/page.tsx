'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeLoansReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير قروض الموظفين"
      emptyStateAr="سيتم عرض تقرير قروض الموظفين هنا"
      emptyStateEn="Employee loans report will be displayed here"
      logTag="[hr/report employee-loans]"
      catalogUrlPath="/hr/employee-loans-report"
    />
  );
}
