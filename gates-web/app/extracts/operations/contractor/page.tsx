'use client';

import { useState } from 'react';
import { HardHat } from 'lucide-react';
import { AiKnowledgeUploadButton } from '@/components/ai/AiKnowledgeUploadButton';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

export default function ContractorPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setSelectedId(null);
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
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'تعريف المقاول' },
      ]}
      onSave={handleSave}
      savePending={contractorMutation.isPending}
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
