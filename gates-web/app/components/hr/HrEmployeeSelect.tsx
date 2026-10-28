'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { compactControlClass } from '@/components/ui/forms/formTokens';

export type HrEmployeeOption = {
  id: string;
  arabicName: string;
  employeeId?: string | null;
  serial?: string | null;
  basicSalary?: number | string | null;
};

/** Employee picker with server-side search (the API caps list size). */
export function HrEmployeeSelect({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (employeeId: string, employee?: HrEmployeeOption) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useApiQuery<HrEmployeeOption[]>(
    ['hr-employee-select', search],
    '/hr/employees',
    { limit: 50, ...(search.trim() ? { search: search.trim() } : {}) }
  );
  const rows = data?.data ?? [];

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="search"
        className={`${compactControlClass} sm:w-40`}
        placeholder="بحث بالاسم أو الكود"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className={`${compactControlClass} flex-1 ${invalid ? 'border-red-400' : ''}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value, rows.find((r) => r.id === e.target.value))}
      >
        <option value="">{isLoading ? 'جاري التحميل…' : 'اختر الموظف'}</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.arabicName}
            {r.employeeId || r.serial ? ` — ${r.employeeId ?? r.serial}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
