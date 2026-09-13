'use client';

import { useState, useEffect } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

import type { ApiError } from '@/lib/api/types';

type EinvoiceSettings = {
  username?: string;
  password1?: string;
  password2?: string;
  tokenAPI?: string;
  invoiceAPI?: string;
  certThumbPrint?: string;
};

export default function ElectronicInvoicingSettingsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsData, setSettingsData] = useState({
    username: '',
    password1: '',
    password2: '',
    tokenAPI: '',
    invoiceAPI: '',
    certThumbPrint: ''
  });

  // Fetch settings
  const { data: settingsResponse } = useApiQuery<EinvoiceSettings>(
    ['electronic-invoice-settings'],
    '/electronic-invoices/settings'
  );

  useEffect(() => {
    if (settingsResponse?.data) {
      setSettingsData({
        username: settingsResponse.data.username || '',
        password1: settingsResponse.data.password1 || '',
        password2: settingsResponse.data.password2 || '',
        tokenAPI: settingsResponse.data.tokenAPI || '',
        invoiceAPI: settingsResponse.data.invoiceAPI || '',
        certThumbPrint: settingsResponse.data.certThumbPrint || ''
      });
    }
  }, [settingsResponse]);

  // Settings mutation
  const settingsMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/electronic-invoices/settings',
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الإعدادات بنجاح');
        invalidateQuery(['electronic-invoice-settings']);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    settingsMutation.mutate(settingsData);
  };

  const handleCancel = () => {
    if (settingsResponse?.data) {
      setSettingsData({
        username: settingsResponse.data.username || '',
        password1: settingsResponse.data.password1 || '',
        password2: settingsResponse.data.password2 || '',
        tokenAPI: settingsResponse.data.tokenAPI || '',
        invoiceAPI: settingsResponse.data.invoiceAPI || '',
        certThumbPrint: settingsResponse.data.certThumbPrint || ''
      });
    }
    setError('');
    setSuccess('');
  };

  return (
    <div className="p-4" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">إعدادات الفواتير الإلكترونية</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-6">
            <div className="space-y-4">
              {/* Username */}
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="block text-sm font-medium text-gray-700 w-32">إسم المستخدم</label>
                <input
                  type="text"
                  placeholder="إدخل رقم المستخدم"
                  value={settingsData.username}
                  onChange={(e) => setSettingsData({...settingsData, username: e.target.value})}
                  className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] placeholder-gray-400 focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                />
              </div>

              {/* Password 1 */}
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="block text-sm font-medium text-gray-700 w-32">كلمة السر 1</label>
                <input
                  type="password"
                  placeholder="إدخل كلمة السر الأولى"
                  value={settingsData.password1}
                  onChange={(e) => setSettingsData({...settingsData, password1: e.target.value})}
                  className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] placeholder-gray-400 focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                />
              </div>

              {/* Password 2 */}
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="block text-sm font-medium text-gray-700 w-32">كلمة السر 2</label>
                <input
                  type="password"
                  placeholder="إدخل كلمة السر الثانية"
                  value={settingsData.password2}
                  onChange={(e) => setSettingsData({...settingsData, password2: e.target.value})}
                  className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] placeholder-gray-400 focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                />
              </div>

              {/* TokenAPI */}
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="block text-sm font-medium text-gray-700 w-32">TokenAPI</label>
                <input
                  type="text"
                  placeholder="إدخل TokenAPI"
                  value={settingsData.tokenAPI}
                  onChange={(e) => setSettingsData({...settingsData, tokenAPI: e.target.value})}
                  className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] placeholder-gray-400 focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                />
              </div>

              {/* InvoiceAPI */}
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="block text-sm font-medium text-gray-700 w-32">InvoiceAPI</label>
                <input
                  type="text"
                  placeholder="إدخل InvoiceAPI"
                  value={settingsData.invoiceAPI}
                  onChange={(e) => setSettingsData({...settingsData, invoiceAPI: e.target.value})}
                  className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] placeholder-gray-400 focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                />
              </div>

              {/* CertThumbPrint */}
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="block text-sm font-medium text-gray-700 w-32">CertThumbPrint</label>
                <input
                  type="text"
                  placeholder="إدخل CertThumbPrint"
                  value={settingsData.certThumbPrint}
                  onChange={(e) => setSettingsData({...settingsData, certThumbPrint: e.target.value})}
                  className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] placeholder-gray-400 focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                />
              </div>
            </div>

            {error && <ErrorToast message={error} onClose={() => setError('')} />}
            {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

            {/* Action Buttons */}
            <div className="flex items-center justify-end mt-8 pt-4 border-t border-[#D6EAF3]">
              <ActionButtons 
                onSave={handleSave}
                onCancel={handleCancel}
                saveText={settingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {/* Decorative Bottom Line */}
      <div className="mt-6">
        <div className="h-1 bg-[#0E78AA] rounded w-full" style={{ backgroundImage: 'radial-gradient(circle, #0E78AA 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>
      </div>
    </div>
  );
} 