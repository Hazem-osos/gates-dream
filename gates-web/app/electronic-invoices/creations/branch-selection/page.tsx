'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { ActionButtons } from '@/components/ui/ActionButtons';

export default function BranchSelectionPage() {
  useBackendReachability();

  const [branchData, setBranchData] = useState({
    serialNumber: '',
    arabicName: '',
    branchNumber: '',
    activationNumber: '',
    barcodePrice: 'المستهلك',
    priceList: '10% خصم من سعر الجمهور',
    registrationNumber: '',
    country: 'مصر',
    governorate: 'القاهرة',
    district: 'حى الأشجار',
    city: 'الهرم',
    area: 'مدينة نصر',
    postalCode: '',
    mobileNumber: '',
    street: '',
    address: ''
  });

  return (
    <div className="p-4" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-4">
        <div className="text-right">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">تحديد الفرع</h1>
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
              {/* Right Column */}
              <div className="space-y-2">
                {/* Serial Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المسلسل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم المسلسل"
                    value={branchData.serialNumber}
                    onChange={(e) => setBranchData({...branchData, serialNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Barcode Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر الباركود</label>
                  <select
                    value={branchData.barcodePrice}
                    onChange={(e) => setBranchData({...branchData, barcodePrice: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="المستهلك">المستهلك</option>
                  </select>
                </div>

                {/* Price List */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">قائمة الأسعار</label>
                  <select
                    value={branchData.priceList}
                    onChange={(e) => setBranchData({...branchData, priceList: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="10% خصم من سعر الجمهور">10% خصم من سعر الجمهور</option>
                  </select>
                </div>

                {/* Registration Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم التسجيل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم التسجيل"
                    value={branchData.registrationNumber}
                    onChange={(e) => setBranchData({...branchData, registrationNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الدولة</label>
                  <select
                    value={branchData.country}
                    onChange={(e) => setBranchData({...branchData, country: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="مصر">مصر</option>
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
                  <select
                    value={branchData.city}
                    onChange={(e) => setBranchData({...branchData, city: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="الهرم">الهرم</option>
                  </select>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الموبايل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم الموبايل"
                    value={branchData.mobileNumber}
                    onChange={(e) => setBranchData({...branchData, mobileNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Street */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الشارع</label>
                  <input
                    type="text"
                    placeholder="إدخل إسم الشارع"
                    value={branchData.street}
                    onChange={(e) => setBranchData({...branchData, street: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                  <textarea
                    placeholder="إدخل العنوان"
                    value={branchData.address}
                    onChange={(e) => setBranchData({...branchData, address: e.target.value})}
                    rows={3}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Left Column */}
              <div className="space-y-2">
                {/* Arabic Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإسم العربي</label>
                  <input
                    type="text"
                    placeholder="إدخل الإسم بالعربي"
                    value={branchData.arabicName}
                    onChange={(e) => setBranchData({...branchData, arabicName: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Branch Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الفرع</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم الفرع"
                    value={branchData.branchNumber}
                    onChange={(e) => setBranchData({...branchData, branchNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Activation Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم التفعيل</label>
                  <input
                    type="text"
                    placeholder="إدخل رقم التفعيل"
                    value={branchData.activationNumber}
                    onChange={(e) => setBranchData({...branchData, activationNumber: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>

                {/* Governorate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المحافظة</label>
                  <select
                    value={branchData.governorate}
                    onChange={(e) => setBranchData({...branchData, governorate: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="القاهرة">القاهرة</option>
                  </select>
                </div>

                {/* District */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحى</label>
                  <select
                    value={branchData.district}
                    onChange={(e) => setBranchData({...branchData, district: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="حى الأشجار">حى الأشجار</option>
                  </select>
                </div>

                {/* Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المنطقة</label>
                  <select
                    value={branchData.area}
                    onChange={(e) => setBranchData({...branchData, area: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  >
                    <option value="مدينة نصر">مدينة نصر</option>
                  </select>
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرمز البريدي</label>
                  <input
                    type="text"
                    placeholder="إدخل الرمز البريدي"
                    value={branchData.postalCode}
                    onChange={(e) => setBranchData({...branchData, postalCode: e.target.value})}
                    className="w-full p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex items-center justify-end mt-4 pt-3 border-t border-[#D6EAF3]">
              <ActionButtons />
            </div>
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
} 