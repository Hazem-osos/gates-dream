'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { HrMasterCodeRecordInput } from '@/lib/validation/hr.schema';
import { CompactFormField, FormSectionCard } from '@/components/ui';

export function HrMasterCodeFields({
  register,
  errors,
}: {
  register: UseFormRegister<HrMasterCodeRecordInput>;
  errors: FieldErrors<HrMasterCodeRecordInput>;
}) {
  return (
    <FormSectionCard title="بيانات الكود" className="mb-0 mt-0 shadow-none" bodyClassName="md:grid-cols-3 lg:grid-cols-3">
      <CompactFormField label="الكود" placeholder="إدخل الكود" {...register('code')} />
      <CompactFormField
        label="الإسم العربي"
        placeholder="إدخل الاسم العربي"
        error={errors.arabicName?.message}
        {...register('arabicName')}
      />
      <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الاسم الإنجليزي" {...register('englishName')} />
    </FormSectionCard>
  );
}
