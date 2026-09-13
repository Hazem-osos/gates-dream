'use client';

import { useState, useEffect } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type LookupRow = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string;
};

export default function ReservationPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    propertyId: '',
    customerId: '',
    reservationDate: '',
    reservationAmount: '',
    notes: '',
    expiryDate: '',
  });

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

  // Reservation mutation
  const reservationMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/real-estate/reservations',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الحجز بنجاح');
        invalidateQuery(['reservations']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, reservationDate: today }));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.propertyId) {
      setError('يرجى اختيار العقار');
      return;
    }

    if (!formData.customerId) {
      setError('يرجى اختيار العميل');
      return;
    }

    if (!formData.reservationDate) {
      setError('يرجى تحديد تاريخ الحجز');
      return;
    }

    const requestBody: Record<string, unknown> = {
      propertyId: formData.propertyId,
      customerId: formData.customerId,
      reservationDate: new Date(formData.reservationDate).toISOString(),
      reservationAmount: formData.reservationAmount ? parseFloat(formData.reservationAmount) : undefined,
      notes: formData.notes || undefined,
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
    };

    reservationMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      propertyId: '',
      customerId: '',
      reservationDate: '',
      reservationAmount: '',
      notes: '',
      expiryDate: '',
    });
    setError('');
    setSuccess('');
  };

  const inputCls = "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-none">
        <div className="text-right mb-6">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">إدارة الحجوزات</h1>
          <div className="h-1 bg-sky-700 rounded w-full" />
        </div>

        <OuterCard>
          <InnerCard>
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">العقار</label>
                  <select
                    value={formData.propertyId}
                    onChange={(e) => handleInputChange('propertyId', e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">اختر العقار</option>
                    {properties.map((prop) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.code || prop.arabicName || prop.id}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <label className="block text-sm text-[#094C6B] mb-2">تاريخ الحجز</label>
                  <input
                    type="date"
                    value={formData.reservationDate}
                    onChange={(e) => handleInputChange('reservationDate', e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#094C6B] mb-2">مبلغ الحجز</label>
                <input
                  type="number"
                  value={formData.reservationAmount}
                  onChange={(e) => handleInputChange('reservationAmount', e.target.value)}
                  className={inputCls}
                  placeholder="إدخل مبلغ الحجز"
                />
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
                saveText={reservationMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              />
            </div>
          </InnerCard>
        </OuterCard>
      </div>
    </div>
  );
}

