'use client';

import { HrEmployeeProcedureLogForm } from '@/components/hr/HrEmployeeProcedureLogForm';

export default function EmployeeReinstatementPage() {
  return (
    <HrEmployeeProcedureLogForm
      title="إعادة مباشرة موظف"
      procedureType="reinstatement"
      fromLabel="تاريخ المباشرة"
      optionalEvent={{
        eventType: 'RETURN_FROM_SUSPENSION',
        label: 'عودة من إيقاف خدمة (إعادة تفعيل التوظيف ليدخل مسير الرواتب)',
      }}
    />
  );
}
