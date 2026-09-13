'use client';

import { HrEmployeePickerReportPage } from '@/components/hr/HrEmployeePickerReportPage';

export default function LeaveEntitlementsReportPage() {
  return (
    <HrEmployeePickerReportPage
      title="تقرير صرف مستحقات الأجازة"
      emptyStateAr="سيتم عرض تقرير صرف مستحقات الأجازة هنا"
      emptyStateEn="Leave entitlements report will be displayed here"
      previewPath="/hr/leave-entitlements-report/preview"
      catalogUrlPath="/hr/leave-entitlements-report"
    />
  );
}
