'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeTransferReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير نقل الموظفين"
      emptyStateAr="سيتم عرض تقرير نقل الموظفين هنا"
      emptyStateEn="Employee transfer report will be displayed here"
      logTag="[hr/report employee-transfer]"
      catalogUrlPath="/hr/employee-transfer-report"
    />
  );
}
