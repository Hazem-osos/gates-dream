'use client';

import { useState } from 'react';
import { AiKnowledgeUploadButton } from '@/components/ai/AiKnowledgeUploadButton';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

export default function ContractorPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    serial: '',
    arabicName: '',
    englishName: '',
    taxNumber: '',
    phone: '',
    address: '',
    notes: '',
  });

  const contractorMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/contractors',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ المقاول بنجاح');
        invalidateQuery(['contractors']);
        handleCancel();
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.arabicName) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    contractorMutation.mutate({
      serial: formData.serial || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      taxNumber: formData.taxNumber || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleCancel = () => {
    setFormData({
      serial: '',
      arabicName: '',
      englishName: '',
      taxNumber: '',
      phone: '',
      address: '',
      notes: '',
    });
    setError('');
    setSuccess('');
  };

  return (
    <ExtractsPageChrome
      title="تعريف المقاول"
      module="EXTRACTS / MASTER"
      filters={<AiKnowledgeUploadButton category="CONTRACT" compact />}
    >
      <div className={`${DASH_PANEL} p-5`}>
        <FormSectionCard title="بيانات المقاول" className="mb-0 shadow-none" bodyClassName="md:grid-cols-2">
          <CompactFormField
            label="المسلسل"
            placeholder="إدخل رقم المسلسل"
            value={formData.serial}
            onChange={(e) => handleInputChange('serial', e.target.value)}
          />
          <CompactFormField
            label="الإسم العربي"
            placeholder="إدخل الاسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => handleInputChange('arabicName', e.target.value)}
          />
          <CompactFormField
            label="الإسم الإنجليزي"
            placeholder="إدخل الاسم الإنجليزي"
            value={formData.englishName}
            onChange={(e) => handleInputChange('englishName', e.target.value)}
          />
          <CompactFormField
            label="الرقم الضريبي"
            placeholder="إدخل الرقم الضريبي"
            value={formData.taxNumber}
            onChange={(e) => handleInputChange('taxNumber', e.target.value)}
          />
          <CompactFormField
            label="الهاتف"
            placeholder="إدخل رقم الهاتف"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
          />
          <CompactFormField
            label="العنوان"
            placeholder="إدخل العنوان"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
          />
          <CompactFormField label="ملاحظات" className="md:col-span-2">
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0E79AA] focus:outline-none focus:ring-2 focus:ring-[#0E79AA]/15"
              placeholder="أدخل الملاحظات هنا..."
            />
          </CompactFormField>
        </FormSectionCard>

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <ActionButtons
            onSave={handleSave}
            onCancel={handleCancel}
            saveText={contractorMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          />
        </div>
      </div>
    </ExtractsPageChrome>
  );
}
