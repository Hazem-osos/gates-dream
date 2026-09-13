'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeTerminationReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير إنهاء خدمة الموظفين"
      emptyStateAr="سيتم عرض تقرير إنهاء خدمة الموظفين هنا"
      emptyStateEn="Employee termination report will be displayed here"
      logTag="[hr/report employee-termination]"
      catalogUrlPath="/hr/employee-termination-report"
    />
  );
}
