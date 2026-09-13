'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DocumentSectionNumberPair,
  sectionNumberInputClass,
  sectionNumberLabelClass,
} from '@/components/erp/DocumentSectionNumberPair';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';

type Department = {
  id: string;
  code?: string | null;
  arabicName: string;
};

type Props = {
  disabled?: boolean;
  onLoaded: (order: Record<string, unknown>, departmentId: string) => void;
  onError: (message: string) => void;
  onDepartmentChange?: (departmentId: string) => void;
};

export function PaymentOrderReferenceInputs({
  disabled,
  onLoaded,
  onError,
  onDepartmentChange,
}: Props) {
  const [departmentId, setDepartmentId] = useState('');
  const [number, setNumber] = useState('');
  const [pending, setPending] = useState(false);
  const lastKeyRef = useRef('');
  const onLoadedRef = useRef(onLoaded);
  const onErrorRef = useRef(onError);
  onLoadedRef.current = onLoaded;
  onErrorRef.current = onError;

  const { data: departmentsResponse } = useApiQuery<Department[]>(
    ['hr-departments'],
    '/hr/departments',
    { limit: 200, isActive: true }
  );
  const departments = departmentsResponse?.data ?? [];

  useEffect(() => {
    const deptId = departmentId.trim();
    const num = number.trim();
    if (!deptId || !num || disabled) return;

    const key = `${deptId}:${num}`;
    if (lastKeyRef.current === key) return;

    const timer = window.setTimeout(async () => {
      if (lastKeyRef.current === key) return;
      setPending(true);
      try {
        const dept = departments.find((row) => row.id === deptId);
        const res = await apiClient.get<Record<string, unknown>>('/orders/payment-orders', {
          departmentId: deptId,
          number: num,
          code: dept?.code?.trim() || undefined,
        } as never);
        const order = res.data;
        if (!order?.id) {
          onErrorRef.current('أمر الصرف غير موجود');
          return;
        }
        lastKeyRef.current = key;
        onLoadedRef.current(order, deptId);
      } catch (e) {
        onErrorRef.current(e instanceof Error ? e.message : 'تعذر تحميل أمر الصرف');
      } finally {
        setPending(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [departmentId, departments, disabled, number]);

  return (
    <div className="flex justify-end lg:col-span-2">
      <DocumentSectionNumberPair>
        <div className="w-[8.5rem] shrink-0">
          <label className={sectionNumberLabelClass}>القسم</label>
          <select
            className={sectionNumberInputClass}
            disabled={disabled}
            value={departmentId}
            onChange={(e) => {
              lastKeyRef.current = '';
              const next = e.target.value;
              setDepartmentId(next);
              onDepartmentChange?.(next);
            }}
          >
            <option value="">اختر القسم</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.code ? `${dept.code} — ${dept.arabicName}` : dept.arabicName}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[9.5rem] min-w-0">
          <label className={sectionNumberLabelClass}>الرقم</label>
          <input
            className={sectionNumberInputClass}
            disabled={disabled}
            value={number}
            onChange={(e) => {
              lastKeyRef.current = '';
              setNumber(e.target.value);
            }}
            placeholder={pending ? 'جاري التحميل…' : 'الرقم'}
          />
        </div>
      </DocumentSectionNumberPair>
    </div>
  );
}
