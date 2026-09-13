'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function EmployeeRecommendationsReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير توصيات الموظفين"
      emptyStateAr="سيتم عرض تقرير توصيات الموظفين هنا"
      emptyStateEn="Employee recommendations report will be displayed here"
      logTag="[hr/report employee-recommendations]"
      catalogUrlPath="/hr/employee-recommendations-report"
    />
  );
}
