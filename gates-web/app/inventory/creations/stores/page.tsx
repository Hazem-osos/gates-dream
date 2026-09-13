'use client';

import { useState } from 'react';
import { Warehouse } from 'lucide-react';
import {
  PageHeader,
  Button,
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { WarehousesListSection, type WarehouseRow } from '@/components/inventory/WarehousesListSection';
import { AccountSelect } from '@/components/form/AccountSelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { useRouter } from 'next/navigation';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import type { ApiError } from '@/lib/api/types';

type WarehouseForm = {
  code: string;
  arabicName: string;
  englishName: string;
  storeType: 'MAIN' | 'SUB';
  parentWarehouseId: string;
  inventoryAccountId: string;
  costAccountId: string;
  giftAccountId: string;
  address: string;
  keeperName: string;
};

const emptyForm = (): WarehouseForm => ({
  code: '',
  arabicName: '',
  englishName: '',
  storeType: 'MAIN',
  parentWarehouseId: '',
  inventoryAccountId: '',
  costAccountId: '',
  giftAccountId: '',
  address: '',
  keeperName: '',
});

export default function StoreCardPage() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WarehouseForm>(emptyForm);
  const [error, setError] = useState('');

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/warehouses',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['warehouses']);
        setSelectedId(null);
        setFormData(emptyForm());
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/warehouses/${selectedId}` : '/inventory/warehouses',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['warehouses']);
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending;
  const patch = (next: Partial<WarehouseForm>) => setFormData((prev) => ({ ...prev, ...next }));

  const requestBody = () => ({
    code: formData.code || undefined,
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    storeType: formData.storeType,
    parentWarehouseId: formData.parentWarehouseId || null,
    inventoryAccountId: formData.inventoryAccountId || null,
    costAccountId: formData.costAccountId || null,
    giftAccountId: formData.giftAccountId || null,
    address: formData.address || null,
    keeperName: formData.keeperName || null,
  });

  const handleSave = async () => {
    setError('');
    if (!formData.arabicName) {
      setError('يرجى إدخال اسم المخزن');
      return;
    }
    if (selectedId && formData.parentWarehouseId === selectedId) {
      setError('لا يمكن أن يكون المخزن رئيسيًا لنفسه');
      return;
    }
    if (selectedId) {
      updateMutation.mutate(requestBody());
      return;
    }
    createMutation.mutate(requestBody());
  };

  const handleNew = () => {
    setSelectedId(null);
    setFormData(emptyForm());
    setError('');
  };

  const handleSelect = (row: WarehouseRow) => {
    setSelectedId(row.id);
    setFormData({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      storeType: row.storeType === 'SUB' ? 'SUB' : 'MAIN',
      parentWarehouseId: row.parentWarehouseId ?? '',
      inventoryAccountId: row.inventoryAccountId ?? '',
      costAccountId: row.costAccountId ?? '',
      giftAccountId: row.giftAccountId ?? '',
      address: row.address ?? '',
      keeperName: row.keeperName ?? '',
    });
    setError('');
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}

      <PageHeader
        title="دليل المخازن"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'التعريفات' },
          { label: 'المخازن' },
        ]}
        actions={
          <Button variant="primary" onClick={handleNew}>
            مخزن جديد
          </Button>
        }
      />

      <WarehousesListSection onSelect={handleSelect} selectedId={selectedId} />

      <PageHeader title="بطاقة مخزن" className="mb-4" />
      <div className="mb-4 flex justify-between">
        <UserPermissions />
      </div>

      <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف المخزن" icon={Warehouse}>
        <CompactFormField
          label="رقم المخزن"
          value={formData.code}
          onChange={(e) => patch({ code: e.target.value })}
          placeholder="إدخل رقم المخزن"
        />
        <CompactFormField
          label="اسم المخزن"
          required
          value={formData.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
          placeholder="إدخل الإسم"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={formData.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
          placeholder="إدخل الإسم بالإنجليزي"
        />
        <CompactFormField label="نوع المخزن">
          <select
            className={compactControlClass}
            value={formData.storeType}
            onChange={(e) => patch({ storeType: e.target.value as 'MAIN' | 'SUB' })}
          >
            <option value="MAIN">مخزن رئيسي</option>
            <option value="SUB">فرعي</option>
          </select>
        </CompactFormField>
        <CompactFormField label="م/رئيسي">
          <WarehouseSelect
            value={formData.parentWarehouseId}
            onChange={(parentWarehouseId) => patch({ parentWarehouseId })}
            emptyLabel="—"
          />
        </CompactFormField>
        <CompactFormField label="ح/المخزون">
          <AccountSelect
            value={formData.inventoryAccountId}
            onChange={(inventoryAccountId) => patch({ inventoryAccountId })}
            leafOnly
            placeholder="حساب المخزون"
          />
        </CompactFormField>
        <CompactFormField label="ح/التكلفة">
          <AccountSelect
            value={formData.costAccountId}
            onChange={(costAccountId) => patch({ costAccountId })}
            leafOnly
            placeholder="حساب التكلفة"
          />
        </CompactFormField>
        <CompactFormField label="ح/الهدايا">
          <AccountSelect
            value={formData.giftAccountId}
            onChange={(giftAccountId) => patch({ giftAccountId })}
            leafOnly
            placeholder="حساب الهدايا"
          />
        </CompactFormField>
        <CompactFormField
          label="العنوان"
          value={formData.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="إدخل العنوان"
        />
        <CompactFormField
          label="أمين المخزن"
          value={formData.keeperName}
          onChange={(e) => patch({ keeperName: e.target.value })}
          placeholder="أمين المخزن"
        />
      </FormSectionCard>

      <FormStickyFooter
        onCancel={() => router.back()}
        onSave={handleSave}
        saveLoading={loading}
        saveDisabled={loading}
        status={selectedId ? 'تعديل' : 'مسودة'}
      />
    </div>
  );
}
