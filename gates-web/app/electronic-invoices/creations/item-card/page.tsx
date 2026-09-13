'use client';

import { useState, type ReactNode } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

import type { ApiError } from '@/lib/api/types';

export default function ItemCardPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [itemData, setItemData] = useState({
    serialNumber: '',
    arabicName: '',
    englishName: '',
    mainNumber: '1212378971212',
    specifications: '',
    itemType: 'normal',
    weight: '',
    manufacturer: '',
    color: '',
    countryOfOrigin: '',
    quality: '',
    size: '',
    property1: '',
    property2: '',
    property3: '',
    property4: '',
    property5: ''
  });

  const [costCenter, setCostCenter] = useState('mandatory');
  
  const [additionalOptions, setAdditionalOptions] = useState({
    useExpirationDate: true,
    inactiveItem: true,
    notSubjectToTerms: false,
    cannotBeReturned: false,
    noSellBelowCost: false,
    useSerialNumber: false,
    clothingItem: false
  });

  const [quantities, setQuantities] = useState({
    upperLimit: '',
    orderLimit: '',
    orderLimitPercentage: '',
    lowerLimit: '',
    beginningBalance: '',
    beginningCostPrice: ''
  });

  const [orderPlan, setOrderPlan] = useState({
    minimumOrderLimit: '27,4456',
    numberOfPurchases: '27,4456'
  });

  const [orderPlanData] = useState([
    { supplier: 'المورد', price: 'السعر', supplyDuration: 'مدة التوريد' },
    { supplier: 'المورد', price: 'السعر', supplyDuration: 'مدة التوريد' },
    { supplier: 'المورد', price: 'السعر', supplyDuration: 'مدة التوريد' },
    { supplier: 'المورد', price: 'السعر', supplyDuration: 'مدة التوريد' },
    { supplier: 'المورد', price: 'السعر', supplyDuration: 'مدة التوريد' }
  ]);

  const [assemblyData] = useState([
    { item: 'الصنف', quantity: 'الكمية', cost: 'التكلفة' },
    { item: 'الصنف', quantity: 'الكمية', cost: 'التكلفة' },
    { item: 'الصنف', quantity: 'الكمية', cost: 'التكلفة' },
    { item: 'الصنف', quantity: 'الكمية', cost: 'التكلفة' },
    { item: 'الصنف', quantity: 'الكمية', cost: 'التكلفة' }
  ]);

  const [assemblySummary, setAssemblySummary] = useState({
    totalCost: '27,4456',
    addedCost: '27,4456',
    costPercentage: '27,4456'
  });

  // Item card mutation
  const itemCardMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/electronic-invoices/item-cards',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ بطاقة الصنف بنجاح');
        invalidateQuery(['electronic-invoice-items']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!itemData.arabicName) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    itemCardMutation.mutate({
      itemCode: itemData.serialNumber || itemData.arabicName,
      arabicName: itemData.arabicName,
      englishName: itemData.englishName || undefined,
    });
  };

  const handleCancel = () => {
    setItemData({
      serialNumber: '',
      arabicName: '',
      englishName: '',
      mainNumber: '1212378971212',
      specifications: '',
      itemType: 'normal',
      weight: '',
      manufacturer: '',
      color: '',
      countryOfOrigin: '',
      quality: '',
      size: '',
      property1: '',
      property2: '',
      property3: '',
      property4: '',
      property5: ''
    });
    setError('');
    setSuccess('');
  };

  const tabs = [
    { id: 'assembly', label: 'صنف تجميعي' },
    { id: 'orderPlan', label: 'مخطط طلبية' },
    { id: 'quantities', label: 'الكميات' },
    { id: 'options', label: 'خيارات' },
    { id: 'unitsPrices', label: 'الوحدات و الأسعار' },
    { id: 'general', label: 'عام' }
  ];

  const additionalOptionDefinitions: {
    key: keyof typeof additionalOptions;
    label: string;
    icon: ReactNode;
  }[] = [
    {
      key: 'useExpirationDate',
      label: 'إستخدام تاريخ الصلاحية',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'inactiveItem',
      label: 'صنف غير نشط',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
        </svg>
      ),
    },
    {
      key: 'notSubjectToTerms',
      label: 'لا يخضع للشروط والخصومات',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
    },
    {
      key: 'cannotBeReturned',
      label: 'لا يمكن إرجاعه',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
    },
    {
      key: 'noSellBelowCost',
      label: 'عدم السماح بالبيع أقل من سعر التكلفة',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
    },
    {
      key: 'useSerialNumber',
      label: 'إستخدام السيريال',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'clothingItem',
      label: 'صنف الملابس',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-4" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-4">
        <div className="text-right">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">بطاقة الصنف</h1>
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
            {/* Item Identification Section */}
            <div className="grid grid-cols-2 gap-6 mb-4">
              {/* Left Column */}
              <div className="space-y-2">
                {/* Serial Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المسلسل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم المسلسل"
                    value={itemData.serialNumber}
                    onChange={(e) => setItemData({...itemData, serialNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Arabic Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإسم العربي</label>
                  <input
                    type="text"
                    placeholder="إدخل الإسم"
                    value={itemData.arabicName}
                    onChange={(e) => setItemData({...itemData, arabicName: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                {/* Archive Button */}
                <div className="pt-6">
                  <button className="w-full px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold text-base border-2 border-gray-400 hover:border-gray-500">
                    <div className="flex items-center justify-center space-x-2 space-x-reverse">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-14 0h14" />
                      </svg>
                      <span>أرشفة</span>
                    </div>
                  </button>
                </div>

                {/* English Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإسم الإنجليزي</label>
                  <input
                    type="text"
                    placeholder="إدخل الإسم بالإنجليزي"
                    value={itemData.englishName}
                    onChange={(e) => setItemData({...itemData, englishName: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-6">
              <div className="flex flex-row-reverse gap-4 bg-white rounded-full shadow-lg px-4 py-2 border border-[#E6F0F7] relative z-10">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-7 py-2 text-base font-bold rounded-full focus:outline-none transition-all duration-200
                      ${activeTab === tab.id
                        ? 'text-white bg-gradient-to-l from-[#0E79AA] to-[#3EC6E0] shadow-xl -mt-2 scale-105 border-2 border-[#0E79AA]'
                        : 'text-gray-400 bg-transparent hover:bg-[#F6FBFD] hover:text-[#0E79AA]'}
                    `}
                    style={{ minWidth: 180 }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content - General */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-2 gap-6">
                {/* Right Column */}
                <div className="space-y-2">
                  {/* Main Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">م/ الرئيسي</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={itemData.mainNumber}
                        readOnly
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-gray-50 text-gray-700"
                      />
                    
                    </div>
                  </div>

                  {/* Specifications */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المواصفات</label>
                    <textarea
                      placeholder="إدخل المواصفات"
                      value={itemData.specifications}
                      onChange={(e) => setItemData({...itemData, specifications: e.target.value})}
                      rows={4}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المصنع</label>
                    <select
                      value={itemData.manufacturer}
                      onChange={(e) => setItemData({...itemData, manufacturer: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر المصنع</option>
                    </select>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اللون</label>
                    <select
                      value={itemData.color}
                      onChange={(e) => setItemData({...itemData, color: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر اللون</option>
                    </select>
                  </div>

                  {/* Country of Origin */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">بلد المنشأ</label>
                    <select
                      value={itemData.countryOfOrigin}
                      onChange={(e) => setItemData({...itemData, countryOfOrigin: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر بلد المنشأ</option>
                    </select>
                  </div>

                  {/* Quality */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">النوعية</label>
                    <select
                      value={itemData.quality}
                      onChange={(e) => setItemData({...itemData, quality: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر النوعية</option>
                    </select>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المقاس</label>
                    <select
                      value={itemData.size}
                      onChange={(e) => setItemData({...itemData, size: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر المقاس</option>
                    </select>
                  </div>
                </div>

                {/* Left Column */}
                <div className="space-y-2">
                  {/* Item Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">نوع الصنف</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="itemType"
                          value="normal"
                          checked={itemData.itemType === 'normal'}
                          onChange={(e) => setItemData({...itemData, itemType: e.target.value})}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                          itemData.itemType === 'normal'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              itemData.itemType === 'normal' ? 'text-white' : 'text-gray-700'
                            }`}>عادي</span>
                            {itemData.itemType === 'normal' && (
                              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>

                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="itemType"
                          value="bundleSheet"
                          checked={itemData.itemType === 'bundleSheet'}
                          onChange={(e) => setItemData({...itemData, itemType: e.target.value})}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                          itemData.itemType === 'bundleSheet'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              itemData.itemType === 'bundleSheet' ? 'text-white' : 'text-gray-700'
                            }`}>رزمة بالفرخ</span>
                            {itemData.itemType === 'bundleSheet' && (
                              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>

                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="itemType"
                          value="bundleKilo"
                          checked={itemData.itemType === 'bundleKilo'}
                          onChange={(e) => setItemData({...itemData, itemType: e.target.value})}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                          itemData.itemType === 'bundleKilo'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              itemData.itemType === 'bundleKilo' ? 'text-white' : 'text-gray-700'
                            }`}>رزمة بالكيلو</span>
                            {itemData.itemType === 'bundleKilo' && (
                              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>

                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="itemType"
                          value="spool"
                          checked={itemData.itemType === 'spool'}
                          onChange={(e) => setItemData({...itemData, itemType: e.target.value})}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                          itemData.itemType === 'spool'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              itemData.itemType === 'spool' ? 'text-white' : 'text-gray-700'
                            }`}>بكرة</span>
                            {itemData.itemType === 'spool' && (
                              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الوزن</label>
                    <input
                      type="text"
                      placeholder="إدخل الوزن بالأرقام"
                      value={itemData.weight}
                      onChange={(e) => setItemData({...itemData, weight: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                  </div>

                  {/* Property 1 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">خاصية 1</label>
                    <select
                      value={itemData.property1}
                      onChange={(e) => setItemData({...itemData, property1: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر الخاصية</option>
                    </select>
                  </div>

                  {/* Property 2 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">خاصية 2</label>
                    <select
                      value={itemData.property2}
                      onChange={(e) => setItemData({...itemData, property2: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر الخاصية</option>
                    </select>
                  </div>

                  {/* Property 3 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">خاصية 3</label>
                    <select
                      value={itemData.property3}
                      onChange={(e) => setItemData({...itemData, property3: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر الخاصية</option>
                    </select>
                  </div>

                  {/* Property 4 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">خاصية 4</label>
                    <select
                      value={itemData.property4}
                      onChange={(e) => setItemData({...itemData, property4: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر الخاصية</option>
                    </select>
                  </div>

                  {/* Property 5 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">خاصية 5</label>
                    <select
                      value={itemData.property5}
                      onChange={(e) => setItemData({...itemData, property5: e.target.value})}
                      className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    >
                      <option value="">اختر الخاصية</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Units and Prices Tab Content */}
            {activeTab === 'unitsPrices' && (
              <div className="space-y-6">
                {/* Top Control Bar */}
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-[#D6EAF3]">
                  {/* Cost Center Section */}
                  <div className="flex items-center space-x-6 space-x-reverse">
                    <span className="text-sm font-medium text-gray-700">مركز التكلفة:</span>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="costCenter"
                          value="mandatory"
                          checked={costCenter === 'mandatory'}
                          onChange={(e) => setCostCenter(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                          costCenter === 'mandatory'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              costCenter === 'mandatory' ? 'text-white' : 'text-gray-700'
                            }`}>إجباري</span>
                            {costCenter === 'mandatory' && (
                              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>

                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="costCenter"
                          value="optional"
                          checked={costCenter === 'optional'}
                          onChange={(e) => setCostCenter(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                          costCenter === 'optional'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              costCenter === 'optional' ? 'text-white' : 'text-gray-700'
                            }`}>إختياري</span>
                            {costCenter === 'optional' && (
                              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>

                      <label className="relative cursor-pointer group focus:outline-none">
                        <input
                          type="radio"
                          name="costCenter"
                          value="without"
                          checked={costCenter === 'without'}
                          onChange={(e) => setCostCenter(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                          costCenter === 'without'
                            ? 'bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              costCenter === 'without' ? 'text-white' : 'text-gray-700'
                            }`}>بدون</span>
                            {costCenter === 'without' && (
                              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Currency Section */}
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <span className="text-sm font-medium text-gray-700">العملة:</span>
                    <select className="px-3 py-2 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent">
                      <option value="egyptian-pound">جنية مصري</option>
                    </select>
                  </div>
                </div>

                {/* Main Table */}
                <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md">
                  <table className="w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr>
                        {/* Wholesale Column Group */}
                        <th colSpan={6} className="bg-[#1787B8] text-white py-3 px-4 font-bold">
                          الجملة
                        </th>
                        {/* Unit Column Group */}
                        <th colSpan={5} className="bg-[#1787B8] text-white py-3 px-4 font-bold">
                          الوحدة
                        </th>
                      </tr>
                      <tr>
                        {/* Wholesale Sub-headers */}
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">تاجر آجل</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">تاجر نقدي</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">شركة آجل</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">شركة نقدي</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">نصف</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">الجملة</th>
                        {/* Unit Sub-headers */}
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">الوحدة</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">رمز الباركود</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">معامل</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">ثابت</th>
                        <th className="bg-[#1787B8] text-white py-2 px-4 text-sm font-medium">الجملة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Sample Data Rows */}
                      {[1, 2, 3, 4, 5].map((row, idx) => (
                        <tr key={row} className={idx % 2 === 0 ? "bg-[#F6FBFD]" : "bg-[#EAF6FB] border-b border-[#E6F0F7]"}>
                          {/* Wholesale Data Cells */}
                          <td className="py-3 px-4 text-black">تاجر آجل</td>
                          <td className="py-3 px-4 text-black">تاجر نقدي</td>
                          <td className="py-3 px-4 text-black">شركة آجل</td>
                          <td className="py-3 px-4 text-black">شركة نقدي</td>
                          <td className="py-3 px-4 text-black">نصف</td>
                          <td className="py-3 px-4 text-black">الجملة</td>
                          {/* Unit Data Cells */}
                          <td className="py-3 px-4 text-black">الوحدة</td>
                          <td className="py-3 px-4 text-black">رمز الباركود</td>
                          <td className="py-3 px-4 text-black">معامل</td>
                          <td className="py-3 px-4 text-black">ثابت</td>
                          <td className="py-3 px-4 text-black">الجملة</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add Row Button */}
                <div className="flex justify-center">
                  <button className="px-6 py-3 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors font-medium flex items-center space-x-2 space-x-reverse">
                    
                    <span> طباعة الباركود </span>
                  </button>
                </div>
              </div>
            )}

            {/* Options Tab Content */}
            {activeTab === 'options' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  {/* Right Section - Core Item Properties */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-[#0E78AA] mb-4">خصائص الصنف الأساسية</h3>
                    
                    {/* Item Nature */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">طبيعة الصنف</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="relative cursor-pointer group focus:outline-none">
                          <input
                            type="radio"
                            name="itemNature"
                            value="collective"
                            defaultChecked
                            className="sr-only"
                          />
                          <div className="p-4 rounded-xl border-2 transition-all duration-300 bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-white">تجميعي</span>
                              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        </label>

                        <label className="relative cursor-pointer group focus:outline-none">
                          <input
                            type="radio"
                            name="itemNature"
                            value="normal"
                            className="sr-only"
                          />
                          <div className="p-4 rounded-xl border-2 transition-all duration-300 bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-gray-700">عادي</span>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Item Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">نوع الصنف</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="relative cursor-pointer group focus:outline-none">
                          <input
                            type="radio"
                            name="itemTypeOptions"
                            value="service"
                            defaultChecked
                            className="sr-only"
                          />
                          <div className="p-4 rounded-xl border-2 transition-all duration-300 bg-gradient-to-br from-[#0E78AA] to-[#3EC6E0] border-[#0E78AA] text-white shadow-lg transform scale-105">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-white">خدمي</span>
                              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-[#0E78AA] rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        </label>

                        <label className="relative cursor-pointer group focus:outline-none">
                          <input
                            type="radio"
                            name="itemTypeOptions"
                            value="inventory"
                            className="sr-only"
                          />
                          <div className="p-4 rounded-xl border-2 transition-all duration-300 bg-white border-gray-200 text-gray-700 hover:border-[#0E78AA] hover:shadow-md hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-gray-700">مخزني</span>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Item Image */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">صورة الصنف</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          id="itemImage"
                        />
                        <label
                          htmlFor="itemImage"
                          className="flex items-center justify-center p-4 border-2 border-dashed border-[#D6EAF3] rounded-xl bg-[#F6FBFD] hover:border-[#0E78AA] hover:bg-[#E3F6FC] transition-all duration-300 cursor-pointer group"
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <svg className="w-8 h-8 text-[#0E78AA] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-sm text-gray-600 group-hover:text-[#0E78AA]">اضغط لرفع صورة الصنف</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Sales Tax */}
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <input
                        type="checkbox"
                        id="salesTaxExempt"
                        className="w-5 h-5 text-[#0E78AA] rounded border-gray-300 focus:ring-[#0E78AA]"
                      />
                      <label htmlFor="salesTaxExempt" className="text-sm font-medium text-gray-700">معفي من ضريبة المبيعات</label>
                    </div>

                    {/* Tax Value */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">قيمة الضريبة</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="إدخل القيمة بالأرقام"
                          className="w-full p-3 pr-12 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Left Section - Additional Options */}
                  <div className="space-y-3">
                    <div className="border-b border-[#E6F0F7] pb-3">
                      <h3 className="text-base font-semibold text-[#094C6B]">خيارات إضافية</h3>
                      <p className="mt-1 text-xs text-gray-500">اختر ما ينطبق على هذا الصنف.</p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[#E6F0F7] bg-white shadow-sm">
                      {additionalOptionDefinitions.map(({ key, label, icon }) => {
                        const checked = additionalOptions[key];
                        return (
                          <label
                            key={key}
                            className={`flex cursor-pointer items-center justify-between gap-3 border-b border-[#F0F5F9] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[#F9FCFD] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#0E78AA]/20 focus-within:ring-offset-1 ${
                              checked ? 'bg-[#F0F7FB]' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setAdditionalOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                              className="sr-only"
                            />
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3F8] text-[#0E78AA] ring-1 ring-[#D6EAF3]/90"
                                aria-hidden
                              >
                                {icon}
                              </span>
                              <span
                                className={`text-sm font-medium leading-snug ${
                                  checked ? 'text-[#094C6B]' : 'text-gray-800'
                                }`}
                              >
                                {label}
                              </span>
                            </div>
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                checked
                                  ? 'border-[#0E78AA] bg-[#0E78AA] text-white'
                                  : 'border-gray-300 bg-white text-transparent'
                              }`}
                              aria-hidden
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assembly Item Tab Content */}
            {activeTab === 'assembly' && (
              <div className="space-y-6">
                {/* Main Table */}
                <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md">
                  <table className="w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الصنف</th>
                        <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الكمية</th>
                        <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">التكلفة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assemblyData.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#F6FBFD]" : "bg-[#EAF6FB] border-b border-[#E6F0F7]"}>
                          <td className="py-3 px-4 text-black">{row.item}</td>
                          <td className="py-3 px-4 text-black">{row.quantity}</td>
                          <td className="py-3 px-4 text-black">{row.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3]">
                  <div className="grid grid-cols-3 gap-6">
                    {/* Total Cost */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">إجمالي التكلفة</label>
                      <input
                        type="text"
                        value={assemblySummary.totalCost}
                        onChange={(e) => setAssemblySummary({...assemblySummary, totalCost: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Added Cost */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">تكلفة مضافة</label>
                      <input
                        type="text"
                        value={assemblySummary.addedCost}
                        onChange={(e) => setAssemblySummary({...assemblySummary, addedCost: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Cost Percentage */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">نسبة من التكلفة</label>
                      <input
                        type="text"
                        value={assemblySummary.costPercentage}
                        onChange={(e) => setAssemblySummary({...assemblySummary, costPercentage: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quantities Tab Content */}
            {activeTab === 'quantities' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Upper Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الحد الاعلى</label>
                      <input
                        type="text"
                        placeholder="إدخل الحد الأعلى"
                        value={quantities.upperLimit}
                        onChange={(e) => setQuantities({...quantities, upperLimit: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Order Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">حد الطلب</label>
                      <input
                        type="text"
                        placeholder="إدخل حد الطلب"
                        value={quantities.orderLimit}
                        onChange={(e) => setQuantities({...quantities, orderLimit: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Order Limit Percentage */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">حد الطلب نسبة من أخر الفاتورة</label>
                      <input
                        type="text"
                        placeholder="إدخل النسبة المئوية"
                        value={quantities.orderLimitPercentage}
                        onChange={(e) => setQuantities({...quantities, orderLimitPercentage: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Lower Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
                      <input
                        type="text"
                        placeholder="إدخل الحد الأدنى"
                        value={quantities.lowerLimit}
                        onChange={(e) => setQuantities({...quantities, lowerLimit: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Beginning Balance */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">رصيد أول المدة</label>
                      <input
                        type="text"
                        placeholder="إدخل رصيد أول المدة"
                        value={quantities.beginningBalance}
                        onChange={(e) => setQuantities({...quantities, beginningBalance: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Beginning Cost Price */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">سعر تكلفة أول المدة</label>
                      <input
                        type="text"
                        placeholder="إدخل سعر التكلفة"
                        value={quantities.beginningCostPrice}
                        onChange={(e) => setQuantities({...quantities, beginningCostPrice: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Plan Tab Content */}
            {activeTab === 'orderPlan' && (
              <div className="space-y-6">
                {/* Table Section */}
                <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md">
                  <table className="w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">المورد</th>
                        <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">السعر</th>
                        <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">مدة التوريد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderPlanData.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#F6FBFD]" : "bg-[#EAF6FB] border-b border-[#E6F0F7]"}>
                          <td className="py-3 px-4 text-black">{row.supplier}</td>
                          <td className="py-3 px-4 text-black">{row.price}</td>
                          <td className="py-3 px-4 text-black">{row.supplyDuration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Input Fields Section */}
                <div className="p-4 bg-gray-50 rounded-lg border border-[#D6EAF3]">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Right Input Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للطلبية</label>
                      <input
                        type="text"
                        value={orderPlan.minimumOrderLimit}
                        onChange={(e) => setOrderPlan({...orderPlan, minimumOrderLimit: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>

                    {/* Left Input Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">عدد مرات الشراء</label>
                      <input
                        type="text"
                        value={orderPlan.numberOfPurchases}
                        onChange={(e) => setOrderPlan({...orderPlan, numberOfPurchases: e.target.value})}
                        className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Tab Contents */}
            {activeTab !== 'general' && activeTab !== 'unitsPrices' && activeTab !== 'options' && activeTab !== 'quantities' && activeTab !== 'orderPlan' && activeTab !== 'assembly' && (
              <div className="text-center py-8 text-gray-500">
                محتوى {tabs.find(tab => tab.id === activeTab)?.label} سيتم إضافته قريباً
              </div>
            )}
          </div>

          {/* Bottom Action Buttons */}
          {error && <ErrorToast message={error} onClose={() => setError('')} />}
          {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
          
          <div className="flex items-center justify-end mt-4 pt-3 border-t border-[#D6EAF3] px-4 pb-4">
            <ActionButtons 
              onSave={handleSave}
              onCancel={handleCancel}
              saveText={itemCardMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            />
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
} 