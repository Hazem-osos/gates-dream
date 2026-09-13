'use client';

import { useState } from 'react';
import Image from 'next/image';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

function createDefaultCustomerData() {
  return {
    balance: '',
    serialNumber: '',
    arabicName: '',
    englishName: '',
    taxData: false,
    customerType: 'company',
    how: 'local',
    nationality: 'مصري',
    code: '',
    nationalId: '',
    commercialRegister: '',
    phone1: '',
    phone2: '',
    mobile: '',
    fax: '',
    email: '',
    website: '',
    taxAuthority: '1212378971212',
    taxAuthorityName: 'مأمورية شركات مساهمة',
    country: 'مصر',
    city: 'القاهرة',
    area: 'مدينة نصر',
    street: '',
    postalCode: '',
    poBox: '',
    sellingPrice: 'تجاري',
    transactionType: 'شركة تجارية مصرية',
    warning: 'debtor',
    estimatedBudget: '',
    currency: '(0001) جنية مصري',
    main: '',
    account: '',
    representative: '',
    priceList: '',
  };
}

export default function CustomerCardPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customerData, setCustomerData] = useState(createDefaultCustomerData);

  const customerCardMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/electronic-invoices/customers',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ بطاقة العميل بنجاح');
        invalidateQuery(['electronic-invoice-customers']);
      },
      onError: (err: { message?: string }) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!customerData.arabicName?.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    if (!customerData.taxAuthority?.trim()) {
      setError('يرجى إدخال الرقم الضريبي');
      return;
    }
    const emailTrim = customerData.email?.trim() ?? '';
    const email =
      emailTrim && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim) ? emailTrim : undefined;
    const addressParts = [
      customerData.country,
      customerData.city,
      customerData.area,
      customerData.street,
    ].filter(Boolean);
    customerCardMutation.mutate({
      taxNumber: customerData.taxAuthority.trim(),
      arabicName: customerData.arabicName.trim(),
      englishName: customerData.englishName?.trim() || undefined,
      address: addressParts.length ? addressParts.join('، ') : undefined,
      city: customerData.city?.trim() || undefined,
      country: customerData.country?.trim() || undefined,
      phone: customerData.mobile?.trim() || customerData.phone1?.trim() || undefined,
      email,
      registrationNumber: customerData.nationalId?.trim() || undefined,
      commercialRegistration: customerData.commercialRegister?.trim() || undefined,
    });
  };

  const handleCancel = () => {
    setCustomerData(createDefaultCustomerData());
    setError('');
    setSuccess('');
  };

  return (
    <div className="p-4" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-4">
        <div className="text-right">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">بطاقة عميل</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>

      {/* Top Bar: Action Icons and User Permissions */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <UserPermissions />
        </div>
      </div>

      <OuterCard>
                  <InnerCard>
                      <div className="p-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Right Column (now first) */}
              <div className="space-y-2">
                {/* Serial Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المسلسل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم المسلسل"
                    value={customerData.serialNumber}
                    onChange={(e) => setCustomerData({...customerData, serialNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Arabic Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإسم العربي</label>
                  <input
                    type="text"
                    placeholder="إدخل الإسم بالعربي"
                    value={customerData.arabicName}
                    onChange={(e) => setCustomerData({...customerData, arabicName: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* English Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإسم الإنجليزي</label>
                  <input
                    type="text"
                    placeholder="إدخل الإسم بالإنجليزي"
                    value={customerData.englishName}
                    onChange={(e) => setCustomerData({...customerData, englishName: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* How */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكيفية</label>
                  <div className="flex space-x-3 space-x-reverse">
                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="how"
                        value="local"
                        checked={customerData.how === 'local'}
                        onChange={(e) => setCustomerData({...customerData, how: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.how === 'local'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.how === 'local' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.how === 'local' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.how === 'local' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>محلي</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="how"
                        value="exporter"
                        checked={customerData.how === 'exporter'}
                        onChange={(e) => setCustomerData({...customerData, how: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.how === 'exporter'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.how === 'exporter' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.how === 'exporter' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.how === 'exporter' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>مصدر</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="how"
                        value="exempt"
                        checked={customerData.how === 'exempt'}
                        onChange={(e) => setCustomerData({...customerData, how: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.how === 'exempt'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.how === 'exempt' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.how === 'exempt' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.how === 'exempt' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>معفي</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Nationality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الجنسية</label>
                  <select
                    value={customerData.nationality}
                    onChange={(e) => setCustomerData({...customerData, nationality: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="مصري">مصري</option>
                  </select>
                </div>

                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكود</label>
                  <input
                    type="text"
                    value={customerData.code}
                    onChange={(e) => setCustomerData({...customerData, code: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* National ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرقم القومي</label>
                  <input
                    type="text"
                    placeholder="إدخل الرقم القومي"
                    value={customerData.nationalId}
                    onChange={(e) => setCustomerData({...customerData, nationalId: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Commercial Register */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السجل التجاري</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم السجل التجاري"
                    value={customerData.commercialRegister}
                    onChange={(e) => setCustomerData({...customerData, commercialRegister: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Phone 1 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف 1</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم الهاتف"
                    value={customerData.phone1}
                    onChange={(e) => setCustomerData({...customerData, phone1: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Phone 2 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف 2</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم الهاتف"
                    value={customerData.phone2}
                    onChange={(e) => setCustomerData({...customerData, phone2: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الموبايل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم الموبايل"
                    value={customerData.mobile}
                    onChange={(e) => setCustomerData({...customerData, mobile: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Fax */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">فاكس</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم الفاكس"
                    value={customerData.fax}
                    onChange={(e) => setCustomerData({...customerData, fax: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإيميل</label>
                  <input
                    type="email"
                    placeholder="إدخل الإيميل"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">موقع</label>
                  <input
                    type="text"
                    placeholder="إدخل الموقع"
                    value={customerData.website}
                    onChange={(e) => setCustomerData({...customerData, website: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Left Column (now second) */}
              <div className="space-y-2">
                {/* Balance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرصيد</label>
                  <input
                    type="text"
                    placeholder="إدخل الرصيد"
                    value={customerData.balance}
                    onChange={(e) => setCustomerData({...customerData, balance: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Tax Data Checkbox */}
                <div className="flex items-center space-x-3 space-x-reverse">
                  <input
                    type="checkbox"
                    checked={customerData.taxData}
                    onChange={(e) => setCustomerData({...customerData, taxData: e.target.checked})}
                    className="w-4 h-4 text-[#0E78AA] rounded border-gray-300 focus:ring-[#0E78AA]"
                  />
                  <span className="text-sm text-gray-700">البيانات الضريبية</span>
                </div>

                {/* Customer Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع العميل</label>
                  <div className="flex space-x-3 space-x-reverse">
                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="customerType"
                        value="company"
                        checked={customerData.customerType === 'company'}
                        onChange={(e) => setCustomerData({...customerData, customerType: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.customerType === 'company'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.customerType === 'company' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.customerType === 'company' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.customerType === 'company' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>شركة</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="customerType"
                        value="individual"
                        checked={customerData.customerType === 'individual'}
                        onChange={(e) => setCustomerData({...customerData, customerType: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.customerType === 'individual'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.customerType === 'individual' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.customerType === 'individual' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.customerType === 'individual' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>فرد</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                  <select
                    value={customerData.sellingPrice}
                    onChange={(e) => setCustomerData({...customerData, sellingPrice: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="تجاري">تجاري</option>
                  </select>
                </div>

                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع التعامل</label>
                  <select
                    value={customerData.transactionType}
                    onChange={(e) => setCustomerData({...customerData, transactionType: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="شركة تجارية مصرية">شركة تجارية مصرية</option>
                  </select>
                </div>

                {/* Tax Authority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">مأمورية الضرائب</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={customerData.taxAuthority}
                      onChange={(e) => setCustomerData({...customerData, taxAuthority: e.target.value})}
                      className=" ml-5 flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                   
                    <div className="ml-2 px-2 py-1 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg text-gray-700 text-sm">
                      {customerData.taxAuthorityName}
                    </div>
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الدولة</label>
                  <select
                    value={customerData.country}
                    onChange={(e) => setCustomerData({...customerData, country: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="مصر">مصر</option>
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
                  <select
                    value={customerData.city}
                    onChange={(e) => setCustomerData({...customerData, city: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="القاهرة">القاهرة</option>
                  </select>
                </div>

                {/* Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المنطقة</label>
                  <select
                    value={customerData.area}
                    onChange={(e) => setCustomerData({...customerData, area: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="مدينة نصر">مدينة نصر</option>
                  </select>
                </div>

                {/* Street */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الشارع</label>
                  <input
                    type="text"
                    placeholder="إدخل إسم الشارع"
                    value={customerData.street}
                    onChange={(e) => setCustomerData({...customerData, street: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرمز البريدي</label>
                  <input
                    type="text"
                    placeholder="إدخل الرمز البريدي"
                    value={customerData.postalCode}
                    onChange={(e) => setCustomerData({...customerData, postalCode: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* PO Box */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">صندوق البريد</label>
                  <input
                    type="text"
                    value={customerData.poBox}
                    onChange={(e) => setCustomerData({...customerData, poBox: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Additional Fields Before Warning */}
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Main */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرئيسي</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={customerData.main}
                      onChange={(e) => setCustomerData({...customerData, main: e.target.value})}
                      className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                  
                  </div>
                </div>

                {/* Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحساب</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={customerData.account}
                      onChange={(e) => setCustomerData({...customerData, account: e.target.value})}
                      className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                   
                  </div>
                </div>

                {/* Representative */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المندوب</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={customerData.representative}
                      onChange={(e) => setCustomerData({...customerData, representative: e.target.value})}
                      className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                   
                  </div>
                </div>

                {/* Price List */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">قائمة الأسعار</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={customerData.priceList}
                      onChange={(e) => setCustomerData({...customerData, priceList: e.target.value})}
                      className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                    
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Section */}
            <div className="mt-4 pt-3 border-t border-[#D6EAF3]">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Warning Fields */}
                <div className="space-y-2">
                  {/* Estimated Budget */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">موازنة تقديرية</label>
                    <input
                      type="text"
                      placeholder="إدخل الموازنة التقديرية"
                      value={customerData.estimatedBudget}
                      onChange={(e) => setCustomerData({...customerData, estimatedBudget: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رمز العملة</label>
                    <select
                      value={customerData.currency}
                      onChange={(e) => setCustomerData({...customerData, currency: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="(0001) جنية مصري">(0001) جنية مصري</option>
                    </select>
                  </div>
                </div>

                {/* Right Column - Warning Radio Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تحذير</label>
                  <div className="flex space-x-3 space-x-reverse">
                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="warning"
                        value="debtor"
                        checked={customerData.warning === 'debtor'}
                        onChange={(e) => setCustomerData({...customerData, warning: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.warning === 'debtor'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.warning === 'debtor' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.warning === 'debtor' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.warning === 'debtor' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>مدين</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="warning"
                        value="creditor"
                        checked={customerData.warning === 'creditor'}
                        onChange={(e) => setCustomerData({...customerData, warning: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.warning === 'creditor'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.warning === 'creditor' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.warning === 'creditor' ? 'text-[#0E78AA]' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.warning === 'creditor' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>دائن</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="warning"
                        value="none"
                        checked={customerData.warning === 'none'}
                        onChange={(e) => setCustomerData({...customerData, warning: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        customerData.warning === 'none'
                          ? 'border-[#0E78AA] bg-[#F0F7FB] shadow-sm ring-1 ring-[#0E78AA]/10'
                          : 'border-gray-200 bg-white hover:border-[#0E78AA]/30 hover:bg-[#F9FCFD] transition-all duration-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              customerData.warning === 'none' ? 'bg-white' : 'bg-gray-300'
                            }`}>
                              <svg className={`w-3 h-3 ${
                                customerData.warning === 'none' ? 'text-gray-500' : 'text-gray-500'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className={`font-semibold text-sm ${
                              customerData.warning === 'none' ? 'text-[#094C6B]' : 'text-gray-600'
                            }`}>بدون</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Links */}
            <div className="mt-4 flex items-center space-x-4 space-x-reverse">
              <button className="flex items-center space-x-2 space-x-reverse text-[#0E78AA] hover:text-[#094C6B] transition-colors">
                <Image src="/lucide_edit.svg" alt="Design" width={16} height={16} />
                <span className="text-sm font-medium">تصميم</span>
              </button>
              <button className="flex items-center space-x-2 space-x-reverse text-[#0E78AA] hover:text-[#094C6B] transition-colors">
                <Image src="/mdi_file.svg" alt="Print" width={16} height={16} />
                <span className="text-sm font-medium">طباعة</span>
              </button>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex items-center justify-end mt-4 pt-3 border-t border-[#D6EAF3]">
              {error && <ErrorToast message={error} onClose={() => setError('')} />}
              {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
              <ActionButtons 
                onSave={handleSave}
                onCancel={handleCancel}
                saveText={customerCardMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
} 