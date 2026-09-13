"use client";

import React from 'react';
import Image from 'next/image';

interface TaxInfoOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TaxInfoOverlay({ isOpen, onClose }: TaxInfoOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop with fade animation */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity duration-300 ease-in-out"
        onClick={onClose}
      />
      
      {/* Modal with slide-up animation */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-2xl w-full max-w-2xl transform transition-all duration-300 ease-in-out border border-[#E3EAF3]"
          style={{ 
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateY(0)' : 'translateY(20px)'
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#E3EAF3]">
            <h2 className="text-lg font-bold text-center text-black w-full">بيانات دعم الفاتورة الإلكترونية</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <Image src="/hugeicons_delete-02.svg" alt="close" width={20} height={20} />
            </button>
          </div>
          
          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {/* Row 1: National Number and Tax Registration */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">الرقم القومي</label>
                <input
                  type="text"
                  placeholder="إدخل الرقم"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">رقم التسجيل الضريبي</label>
                <input
                  type="text"
                  placeholder="إدخل الرقم"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              {/* Row 2: Tax Authority and Transaction Type */}
              <div className="space-y-2 col-span-2">
                <label className="block text-gray-700 text-right text-sm">مأمورية الضرائب</label>
                <div className="flex gap-2">
                  <select className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none min-w-[180px]">
                    <option>البنك الأهلي جاري مصري- فرع السادات</option>
                    <option>بنك مصر</option>
                    <option>بنك القاهرة</option>
                  </select>
                  <div className="relative w-full">
                    <input
                      type="text"
                      defaultValue="121237897/1212"
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 pr-8 text-sm text-black focus:outline-none"
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center bg-blue-200 rounded-lg p-1"
                      style={{ height: '24px', width: '24px' }}
                    >
                      <Image src="/magnifying-glass-1.svg" alt="search" width={16} height={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">نوع التعامل</label>
                <select 
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none" 
                  dir="rtl"
                >
                  <option value="cash">نقدي</option>
                  <option value="credit">آجل</option>
                </select>
              </div>

              {/* Row 3: Governorate and Country */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">المحافظة</label>
                <select className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none" dir="rtl">
                  <option value="cairo">القاهرة</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">الدولة</label>
                <select className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none" dir="rtl">
                  <option value="egypt">مصر</option>
                </select>
              </div>

              {/* Row 4: City and Street Name */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">المدينة</label>
                <select className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none" dir="rtl">
                  <option value="nasr">مدينة نصر</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">إسم الشارع</label>
                <input
                  type="text"
                  placeholder="إدخل اسم الشارع"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              {/* Row 5: District and Building Number */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">الحى</label>
                <input
                  type="text"
                  placeholder="إدخل اسم الحى"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">رقم المبنى</label>
                <input
                  type="text"
                  placeholder="رقم المبنى"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              {/* Row 6: Additional Address and Postal Code */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">العنوان الإضافي</label>
                <input
                  type="text"
                  placeholder="إدخل العنوان الإضافي"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 text-right text-sm">الرقم البريدي</label>
                <input
                  type="text"
                  placeholder="إدخل الرقم البريدي"
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>

              {/* Row 7: Full Address (spans both columns) */}
              <div className="col-span-2 space-y-2">
                <label className="block text-gray-700 text-right text-sm">العنوان الكامل</label>
                <textarea
                  placeholder="إدخل العنوان الكامل"
                  rows={3}
                  className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-2 py-1 text-sm text-black focus:outline-none"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-[#E3EAF3]">
              <button type="button" onClick={onClose} className="flex-1 bg-[#2A63D0] hover:bg-blue-700 text-white rounded-lg px-8 py-2 text-sm font-medium">
                تراجع
              </button>
              <button className="flex-1 bg-[#25BB64] hover:bg-green-700 text-white rounded-lg px-8 py-2 text-sm font-medium">
                حفظ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 