'use client';

import Link from 'next/link';
import { HrEmployeeProcedureLogForm } from '@/components/hr/HrEmployeeProcedureLogForm';

export default function EmployeeOnboardingPage() {
  return (
    <>
      <p className="mx-4 mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        لتعيين موظف جديد أضفه أولاً من{' '}
        <Link className="text-brand underline" href="/hr/employee-data">
          بيانات الموظفين
        </Link>{' '}
        و
        <Link className="text-brand underline" href="/hr/employee-contract">
          عقد الموظف
        </Link>
        ، ثم سجّل تاريخ مباشرته للعمل هنا.
      </p>
      <HrEmployeeProcedureLogForm title="مباشرة موظف" procedureType="onboarding" fromLabel="تاريخ المباشرة" />
    </>
  );
}
