'use client';

import { useState, useEffect } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type LookupRow = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string;
};

export default function ClosurePage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    propertyId: '',
    unitId: '',
    customerId: '',
    closureDate: '',
    salePrice: '',
    paymentMethod: '',
    notes: '',
    useWave3Contract: false,
  });
  const [pending, setPending] = useState(false);

  // Fetch properties and customers
  const { data: propertiesResponse } = useApiQuery<LookupRow[]>(
    ['properties'],
    '/real-estate/properties',
    { limit: 1000, isActive: true }
  );
  const properties = propertiesResponse?.data || [];

  const { data: customersResponse } = useApiQuery<LookupRow[]>(
    ['real-estate-customers'],
    '/accounting/customers',
    { limit: 1000, isActive: true }
  );
  const customers = customersResponse?.data || [];

  const { data: unitsResponse } = useApiQuery<LookupRow[]>(
    ['real-estate-units'],
    '/real-estate/units',
    { limit: 500 },
    { enabled: formData.useWave3Contract }
  );
  const units = unitsResponse?.data || [];

  // Closure mutation
  const closureMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/real-estate/closures',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الإقفال بنجاح');
        invalidateQuery(['closures']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, closureDate: today }));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!formData.customerId) {
      setError('يرجى اختيار العميل');
      return;
    }

    if (!formData.closureDate) {
      setError('يرجى تحديد تاريخ الإقفال');
      return;
    }

    if (!formData.salePrice) {
      setError('يرجى إدخال سعر البيع');
      return;
    }

    const salePrice = parseFloat(formData.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      setError('سعر البيع غير صالح');
      return;
    }

    if (formData.useWave3Contract) {
      if (!formData.unitId) {
        setError('يرجى اختيار الوحدة (محرك Wave 3)');
        return;
      }
      setPending(true);
      try {
        const contractRes = await apiClient.post<{ id: string }>('/real-estate/contracts', {
          unitId: formData.unitId,
          customerId: formData.customerId,
          contractNumber: `REC-${Date.now()}`,
          contractDate: new Date(formData.closureDate).toISOString(),
          totalContractAmount: salePrice,
          downPayment: Math.min(salePrice * 0.2, salePrice),
          frequency: 'MONTHLY',
          installmentCount: 10,
        });
        const contractId = contractRes.data.id;
        await apiClient.post(`/real-estate/contracts/${contractId}/post-contract`);
        setSuccess('تم إنشاء وترحيل عقد Wave 3 بنجاح');
        handleCancel();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'تعذر حفظ عقد Wave 3';
        setError(msg);
      } finally {
        setPending(false);
      }
      return;
    }

    if (!formData.propertyId) {
      setError('يرجى اختيار العقار');
      return;
    }

    const requestBody: Record<string, unknown> = {
      propertyId: formData.propertyId,
      customerId: formData.customerId,
      closureDate: new Date(formData.closureDate).toISOString(),
      salePrice,
      paymentMethod: formData.paymentMethod || undefined,
      notes: formData.notes || undefined,
    };

    closureMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      propertyId: '',
      unitId: '',
      customerId: '',
      closureDate: '',
      salePrice: '',
      paymentMethod: '',
      notes: '',
      useWave3Contract: false,
    });
    setError('');
    setSuccess('');
  };

  const inputCls = "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-none">
        <div className="text-right mb-6">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">إدارة الإقفالات</h1>
          <div className="h-1 bg-sky-700 rounded w-full" />
        </div>

        <OuterCard>
          <InnerCard>
            <div className="space-y-6 mb-8">
              <label className="flex items-center gap-2 text-sm text-[#094C6B]">
                <input
                  type="checkbox"
                  checked={formData.useWave3Contract}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      useWave3Contract: e.target.checked,
                      propertyId: e.target.checked ? '' : prev.propertyId,
                      unitId: e.target.checked ? prev.unitId : '',
                    }))
                  }
                />
                استخدام عقد Wave 3 (وحدات / أقساط)
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formData.useWave3Contract ? (
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الوحدة</label>
                    <select
                      value={formData.unitId}
                      onChange={(e) => handleInputChange('unitId', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">اختر الوحدة</option>
                      {units.map((u: { id: string; unitCode?: string; status?: string }) => (
                        <option key={u.id} value={u.id}>
                          {u.unitCode || u.id} {u.status ? `(${u.status})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">العقار</label>
                    <select
                      value={formData.propertyId}
                      onChange={(e) => handleInputChange('propertyId', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">اختر العقار</option>
                      {properties.map((prop: { id: string; code?: string; arabicName?: string }) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.code || prop.arabicName || prop.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">العميل</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => handleInputChange('customerId', e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">اختر العميل</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.arabicName || cust.code || cust.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">تاريخ الإقفال</label>
                  <input
                    type="date"
                    value={formData.closureDate}
                    onChange={(e) => handleInputChange('closureDate', e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">سعر البيع</label>
                  <input
                    type="number"
                    value={formData.salePrice}
                    onChange={(e) => handleInputChange('salePrice', e.target.value)}
                    className={inputCls}
                    placeholder="إدخل سعر البيع"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#094C6B] mb-2">طريقة الدفع</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className={inputCls}
                >
                  <option value="">اختر طريقة الدفع</option>
                  <option value="cash">نقدي</option>
                  <option value="bank">بنكي</option>
                  <option value="installment">تقسيط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className={inputCls + ' h-32 resize-none'}
                  placeholder="أدخل الملاحظات هنا..."
                />
              </div>
            </div>

            {error && <ErrorToast message={error} onClose={() => setError('')} />}
            {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

            <div className="flex justify-end mt-6">
              <ActionButtons
                onSave={handleSave}
                onCancel={handleCancel}
                saveText={
                  pending || closureMutation.isPending ? 'جاري الحفظ...' : 'حفظ'
                }
              />
            </div>
          </InnerCard>
        </OuterCard>
      </div>
    </div>
  );
}

