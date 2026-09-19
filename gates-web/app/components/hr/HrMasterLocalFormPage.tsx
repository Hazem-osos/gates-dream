'use client';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrMasterCodeFields } from '@/components/hr/HrMasterCodeFields';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import SuccessToast from '@/components/SuccessToast';
import { hrMasterCodeRecordSchema, type HrMasterCodeRecordInput } from '@/lib/validation/hr.schema';

const empty: HrMasterCodeRecordInput = { code: '', arabicName: '', englishName: '' };

export function HrMasterLocalFormPage({ title, cardTitle = 'بيانات أساسية' }: { title: string; cardTitle?: string }) {
  const [success, setSuccess] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HrMasterCodeRecordInput>({
    resolver: zodResolver(hrMasterCodeRecordSchema) as Resolver<HrMasterCodeRecordInput>,
    defaultValues: empty,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<HrMasterCodeRecordInput> = (values) => {
    console.info(`[HR master local] ${title}`, values);
    setSuccess('تم التحقق من الحقول. ربط واجهة الحفظ على الخادم لهذا التعريف غير مفعّل بعد.');
  };

  const onNew = () => {
    reset(empty);
    setSuccess('');
  };

  return (
    <HrPageChrome title={title} statusLabel="تعريف" onSave={handleSubmit(onSave)} onNew={onNew}>
      <FormSectionCard title={cardTitle}>
        <div className="col-span-full space-y-3">
          <HrMasterCodeFields register={register} errors={errors} />
          {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
        </div>
      </FormSectionCard>
    </HrPageChrome>
  );
}
