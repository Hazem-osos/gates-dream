'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrReportChrome } from '@/components/hr/HrReportChrome';
import {
  ReportFilterDate,
  ReportFilterField,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { hrSimpleReportFilterSchema, type HrSimpleReportFilterInput } from '@/lib/validation/hr.schema';

const defaults: HrSimpleReportFilterInput = {
  hijriDate1: '',
  hijriDate2: '',
  employee: '',
  fromDate: new Date().toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export type HrSimpleReportFilterPageProps = {
  title: string;
  emptyStateAr: string;
  emptyStateEn: string;
  logTag: string;
  catalogUrlPath: string;
};

export function HrSimpleReportFilterPage({
  title,
  emptyStateAr,
  emptyStateEn,
}: HrSimpleReportFilterPageProps) {
  useBackendReachability();

  const {
    register,
    reset,
    control,
    formState: { errors },
  } = useForm<HrSimpleReportFilterInput>({
    resolver: zodResolver(hrSimpleReportFilterSchema) as Resolver<HrSimpleReportFilterInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  return (
    <HrReportChrome
      title={title}
      previewDisabled
      previewLabel="قيد التفعيل"
      onPreview={() => {}}
      onReset={() => reset(defaults)}
    >
      <ReportFilterField label="الموظف" className="sm:col-span-2">
        <input
          type="text"
          className={`${reportFilterInputClass} ${errors.employee ? 'border-red-400' : ''}`}
          placeholder="الموظف"
          {...register('employee')}
        />
        {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
      </ReportFilterField>

      <Controller
        name="fromDate"
        control={control}
        render={({ field }) => (
          <ReportFilterDate label="من التاريخ" value={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        name="toDate"
        control={control}
        render={({ field }) => (
          <ReportFilterDate label="إلى التاريخ" value={field.value} onChange={field.onChange} />
        )}
      />

      <p className="col-span-full rounded-lg bg-slate-50 px-3 py-2 text-center text-[12px] text-slate-500">
        {emptyStateAr} — هذا التقرير قيد التفعيل ولا يتوفر له مصدر بيانات في الخادم حالياً. {emptyStateEn}
      </p>
    </HrReportChrome>
  );
}
