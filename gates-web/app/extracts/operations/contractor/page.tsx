'use client';

import { useState } from 'react';
import { HardHat } from 'lucide-react';
import { AiKnowledgeUploadButton } from '@/components/ai/AiKnowledgeUploadButton';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useMutation } from '@tanstack/react-query';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type ContractorForm = {
  serial: string;
  arabicName: string;
  englishName: string;
  taxNumber: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyForm = (): ContractorForm => ({
  serial: '',
  arabicName: '',
  englishName: '',
  taxNumber: '',
  phone: '',
  address: '',
  notes: '',
});

export default function ContractorPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContractorForm>(emptyForm);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/contractors',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ المقاول بنجاح');
        invalidateQuery(['contractors']);
        invalidateQuery(['extract-contractors-browse']);
        handleCancel();
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!selectedId) throw new Error('معرّف المقاول مطلوب');
      return apiClient.put(`/extracts/contractors/${selectedId}`, payload);
    },
    onSuccess: () => {
      setSuccess('تم تحديث المقاول بنجاح');
      invalidateQuery(['contractors']);
      invalidateQuery(['extract-contractors-browse']);
    },
    onError: (err: ApiError) => {
      setError(err.message || 'حدث خطأ أثناء التحديث');
    },
  });

  const handleInputChange = (field: keyof ContractorForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => ({
    serial: formData.serial || undefined,
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    taxNumber: formData.taxNumber || undefined,
    phone: formData.phone || undefined,
    address: formData.address || undefined,
    notes: formData.notes || undefined,
  });

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const payload = buildPayload();
    if (selectedId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    setFormData(emptyForm());
    setError('');
    setSuccess('');
  };

  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <ExtractsPageChrome
      title="تعريف المقاول"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'تعريف المقاول' },
      ]}
      onSave={handleSave}
      savePending={savePending}
      onNew={handleCancel}
      extraActions={<AiKnowledgeUploadButton category="CONTRACT" compact />}
      favoriteHref="/extracts/operations/contractor"
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      currentId={selectedId}
      browseList={{
        title: 'المقاولون السابقون',
        apiPath: '/extracts/contractors',
        listKey: 'extract-contractors-browse',
        selectedId,
        columns: [
          { id: 'serial', header: 'المسلسل', getValue: (r) => String(r.serial || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: (id, row) => {
          setSelectedId(id);
          setFormData({
            serial: String(row.serial ?? ''),
            arabicName: String(row.arabicName ?? ''),
            englishName: String(row.englishName ?? ''),
            taxNumber: String(row.taxNumber ?? ''),
            phone: String(row.phone ?? ''),
            address: String(row.address ?? ''),
            notes: String(row.notes ?? ''),
          });
        },
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="بيانات المقاول" subtitle="الحقول اللازمة لتعريف المقاول" icon={HardHat}>
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
        <CompactFormField label="ملاحظات" className="sm:col-span-2">
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className={`${compactControlClass} h-24 max-w-none resize-none py-2`}
            placeholder="أدخل الملاحظات هنا..."
          />
        </CompactFormField>
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
