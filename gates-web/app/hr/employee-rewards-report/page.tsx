'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeRewardsReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير مكافأت الموظفين"
      emptyStateAr="سيتم عرض تقرير مكافأت الموظفين هنا"
      emptyStateEn="Employee rewards report will be displayed here"
      logTag="[hr/report employee-rewards]"
      catalogUrlPath="/hr/employee-rewards-report"
    />
  );
}
