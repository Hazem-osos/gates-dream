'use client';

import { HrEmployeeProcedureLogForm } from '@/components/hr/HrEmployeeProcedureLogForm';

export default function EmployeeTrainingCoursePage() {
  return (
    <HrEmployeeProcedureLogForm
      title="دورة تدريبية لموظف"
      procedureType="training"
      withToDate
      fromLabel="من تاريخ"
      textFields={[
        { key: 'courseName', label: 'اسم الدورة', required: true },
        { key: 'courseLocation', label: 'مكان الدورة' },
      ]}
    />
  );
}
