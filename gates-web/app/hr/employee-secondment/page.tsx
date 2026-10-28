'use client';

import { HrEmployeeProcedureLogForm } from '@/components/hr/HrEmployeeProcedureLogForm';

export default function EmployeeSecondmentPage() {
  return (
    <HrEmployeeProcedureLogForm
      title="إنتداب لموظف"
      procedureType="secondment"
      withToDate
      fromLabel="من تاريخ"
      textFields={[{ key: 'placement', label: 'جهة الانتداب', required: true }]}
    />
  );
}
