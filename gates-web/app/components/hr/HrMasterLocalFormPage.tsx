'use client';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { HrMasterCodeFields } from '@/components/hr/HrMasterCodeFields';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DataGridDense, DASH_PANEL } from '@/components/dashboard-primitives';
import SuccessToast from '@/components/SuccessToast';
import { hrMasterCodeRecordSchema, type HrMasterCodeRecordInput } from '@/lib/validation/hr.schema';

const empty: HrMasterCodeRecordInput = { code: '', arabicName: '', englishName: '' };

/**
 * HR master-style screen when backend CRUD is not wired yet: validates with Zod + RHF; save confirms validation only.
 */
export function HrMasterLocalFormPage({ title, cardTitle = 'بيانات أساسية' }: { title: string; cardTitle?: string }) {
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<HrMasterCodeRecordInput>({
    resolver: zodResolver(hrMasterCodeRecordSchema) as Resolver<HrMasterCodeRecordInput>,
    defaultValues: empty,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<HrMasterCodeRecordInput> = (values) => {
    setSuccess('');
    console.info(`[HR master local] ${title}`, values);
    setSuccess('تم التحقق من الحقول. ربط واجهة الحفظ على الخادم لهذا التعريف غير مفعّل بعد.');
  };

  const onCancel = () => {
    reset(empty);
    setSuccess('');
  };

  return (
    <HrPageChrome title={title} module="HR / MASTER">
      <div className="mb-5">
        <DataGridDense
          title={cardTitle}
          rows={[]}
          empty="لا توجد بيانات محمّلة"
          columns={[
            { id: 'idx', header: 'م', cell: () => '—' },
            { id: 'code', header: 'كود', cell: () => '—' },
            { id: 'ar', header: 'الإسم العربي', cell: () => '—' },
            { id: 'en', header: 'الإسم الإنجليزي', cell: () => '—' },
          ]}
        />
      </div>
      <div className={`${DASH_PANEL} p-5`}>
        <HrMasterCodeFields register={register} errors={errors} />
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <ActionButtons onSave={handleSubmit(onSave)} onCancel={onCancel} saveText="تحقق وحفظ محلي" />
        </div>
      </div>
    </HrPageChrome>
  );
}
