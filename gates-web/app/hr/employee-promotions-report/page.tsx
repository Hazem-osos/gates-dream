'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeePromotionsReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير ترقيات الموظفين"
      emptyStateAr="سيتم عرض تقرير ترقيات الموظفين هنا"
      emptyStateEn="Employee promotions report will be displayed here"
      logTag="[hr/report employee-promotions]"
      catalogUrlPath="/hr/employee-promotions-report"
    />
  );
}
