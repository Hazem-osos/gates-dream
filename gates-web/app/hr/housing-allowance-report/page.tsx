'use client';

import { HrSimpleReportFilterPage } from '@/components/hr/HrSimpleReportFilterPage';

export default function HousingAllowanceReportPage() {
  return (
    <HrSimpleReportFilterPage
      title="تقرير صرف مستحقات بدل السكن"
      emptyStateAr="سيتم عرض تقرير صرف مستحقات بدل السكن هنا"
      emptyStateEn="Housing allowance report will be displayed here"
      logTag="[hr/report housing-allowance]"
      catalogUrlPath="/hr/housing-allowance-report"
    />
  );
}
