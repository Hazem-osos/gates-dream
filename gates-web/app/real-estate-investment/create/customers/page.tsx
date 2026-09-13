"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import OuterCard from "@/components/OuterCard";
import { ActionButtons } from "@/components/ui/ActionButtons";
import InnerCard from "@/components/InnerCard";
import { useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from "@/lib/api/types";

export default function CustomersPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    code: "",
    arabicName: "",
    englishName: "",
    address: "",
    contactDate: "26-11-2025",
    hijriDate: "26-11-2025",
    gender: "",
    averagePrice: "",
    phone1: "",
    phone2: "",
    email: "",
    role: "",
    marketingChannel: "1010101",
    roomsCount: "",
    area: "",
    bathroomsCount: "",
    facade: "",
    transferTo: "بائع",
    employee: "محمد محمود",
    followUpDate: "26-11-2025"
  });

  // Customer followup mutation
  const customerFollowupMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/real-estate/customer-followup',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ بيانات العميل بنجاح');
        invalidateQuery(['customer-followup']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      contactDate: today,
      hijriDate: today,
      followUpDate: today,
    }));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.arabicName) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const requestBody: Record<string, unknown> = {
      code: formData.code || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      address: formData.address || undefined,
      followupDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : undefined,
      notes: formData.address || undefined,
    };

    customerFollowupMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      code: "",
      arabicName: "",
      englishName: "",
      address: "",
      contactDate: "",
      hijriDate: "",
      gender: "",
      averagePrice: "",
      phone1: "",
      phone2: "",
      email: "",
      role: "",
      marketingChannel: "",
      roomsCount: "",
      area: "",
      bathroomsCount: "",
      facade: "",
      transferTo: "",
      employee: "",
      followUpDate: ""
    });
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <div className="w-full max-w-none">
        <h1 className="text-xl font-bold text-[#0E78AA] text-right mb-2">تعريف العملاء</h1>
        <div className="h-1 bg-sky-700 w-full mb-4"></div>
        <OuterCard>
          <InnerCard>
            {/* Search and Help Buttons */}
            <div className="flex gap-2 mb-6 justify-end">
              <Button className="bg-[rgba(9,76,107,1)] text-white rounded-lg w-10 h-10 flex items-center justify-center p-0" size="icon" aria-label="بحث">
                <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} />
              </Button>
              <Button className="bg-[rgba(9,76,107,1)] text-white rounded-lg w-10 h-10 flex items-center justify-center p-0" size="icon" aria-label="مساعدة">
                <Image src="/help.svg" alt="مساعدة" width={20} height={20} />
              </Button>
            </div>
            {/* Form */}
            <form className="grid grid-cols-2 gap-8">
              {/* Row 1: الكود | الإسم العربي */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الكود</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل رقم الكود"
                    value={formData.code}
                    onChange={(e) => handleInputChange("code", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الإسم العربي</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل الإسم بالعربي"
                    value={formData.arabicName}
                    onChange={(e) => handleInputChange("arabicName", e.target.value)}
                  />
                </div>
              </div>
              {/* Row 2: الإسم الإنجليزي | العنوان */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الإسم الإنجليزي</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل الإسم الإنجليزي"
                    value={formData.englishName}
                    onChange={(e) => handleInputChange("englishName", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">العنوان</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder=""
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                  />
                </div>
              </div>
              {/* Row 3: تاريخ الإتصال */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">تاريخ الإتصال</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none pr-10" 
                      value={formData.contactDate}
                      onChange={(e) => handleInputChange("contactDate", e.target.value)}
                    />
                    <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                      <Image src="/help.svg" alt="تقويم" width={16} height={16} />
                      <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Row 4: الجنس | متوسط السعر */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الجنس</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none appearance-none pr-8"
                      value={formData.gender}
                      onChange={(e) => handleInputChange("gender", e.target.value)}
                    >
                      <option value="">اختر الجنس</option>
                      <option value="ذكر">ذكر</option>
                      <option value="أنثى">أنثى</option>
                    </select>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">متوسط السعر</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder=""
                    value={formData.averagePrice}
                    onChange={(e) => handleInputChange("averagePrice", e.target.value)}
                  />
                </div>
              </div>
              {/* Row 5: تليفون 1 | تليفون 2 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">تليفون 1</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل رقم التليفون"
                    value={formData.phone1}
                    onChange={(e) => handleInputChange("phone1", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">تليفون 2</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل رقم التليفون"
                    value={formData.phone2}
                    onChange={(e) => handleInputChange("phone2", e.target.value)}
                  />
                </div>
              </div>
              {/* Row 6: الإيميل | الدور */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الإيميل</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل الإيميل"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الدور</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none appearance-none pr-8"
                      value={formData.role}
                      onChange={(e) => handleInputChange("role", e.target.value)}
                    >
                      <option value="">اختر الدور</option>
                      <option value="الأول">الأول</option>
                      <option value="الثاني">الثاني</option>
                      <option value="الثالث">الثالث</option>
                    </select>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              {/* Row 7: قناة التسويق | عدد الغرف */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">قناة التسويق</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none pr-8" 
                        value={formData.marketingChannel}
                        onChange={(e) => handleInputChange("marketingChannel", e.target.value)}
                      />
                      <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                    </div>
                    <Button className="bg-[#0E78AA] text-white px-3 py-2 text-sm rounded-md whitespace-nowrap">
                      الألوان والمواد المساعدة
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">عدد الغرف</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none appearance-none pr-8"
                      value={formData.roomsCount}
                      onChange={(e) => handleInputChange("roomsCount", e.target.value)}
                    >
                      <option value="">اختر عدد الغرف</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4+">4+</option>
                    </select>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              {/* Row 8: المساحة | عدد الحمامات */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">المساحة</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder="إدخل المساحة"
                    value={formData.area}
                    onChange={(e) => handleInputChange("area", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">عدد الحمامات</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none appearance-none pr-8"
                      value={formData.bathroomsCount}
                      onChange={(e) => handleInputChange("bathroomsCount", e.target.value)}
                    >
                      <option value="">اختر عدد الحمامات</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3+">3+</option>
                    </select>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              {/* Row 9: الواجهة */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الواجهة</label>
                  <input 
                    className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" 
                    placeholder=""
                    value={formData.facade}
                    onChange={(e) => handleInputChange("facade", e.target.value)}
                  />
                </div>
              </div>
              {/* Row 10: التحويل إلى */}
              <div className="flex gap-2 items-center">
                <label className="text-[#094C6B] font-medium">التحويل إلى</label>
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="transferTo" 
                      value="بائع"
                      checked={formData.transferTo === "بائع"}
                      onChange={(e) => handleInputChange("transferTo", e.target.value)}
                      className="appearance-none w-5 h-5 border-2 border-[#0E78AA] rounded-full checked:bg-[#0E78AA] checked:border-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA] transition-all" 
                    />
                    <span className="text-base text-[#0E78AA]">بائع</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="transferTo" 
                      value="مدير مبيعات"
                      checked={formData.transferTo === "مدير مبيعات"}
                      onChange={(e) => handleInputChange("transferTo", e.target.value)}
                      className="appearance-none w-5 h-5 border-2 border-[#0E78AA] rounded-full checked:bg-[#0E78AA] checked:border-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA] transition-all" 
                    />
                    <span className="text-base text-[#0E78AA]">مدير مبيعات</span>
                  </label>
                </div>
              </div>
              {/* Row 11: الموظف | الهجري | تاريخ المتابعة */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الموظف</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none pr-8" 
                      value={formData.employee}
                      onChange={(e) => handleInputChange("employee", e.target.value)}
                    />
                    <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1">
                <label className="block text-[#094C6B] font-medium mb-1">تاريخ المتابعة</label>

                  <div className="relative">
                    <input 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none pr-10" 
                      value={formData.hijriDate}
                      onChange={(e) => handleInputChange("hijriDate", e.target.value)}
                    />
                    <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                      <Image src="/help.svg" alt="تقويم" width={16} height={16} />
                      <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} />
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                <label className="block text-[#094C6B] font-medium mb-1">الهجري</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none pr-10" 
                      value={formData.followUpDate}
                      onChange={(e) => handleInputChange("followUpDate", e.target.value)}
                    />
                    <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                      <Image src="/help.svg" alt="تقويم" width={16} height={16} />
                      <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </InnerCard>
          {/* Action Buttons */}
          {error && <ErrorToast message={error} onClose={() => setError('')} />}
          {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
          
          <div className="flex gap-4 mt-16 justify-between flex-row-reverse">
            <ActionButtons 
              onSave={handleSave}
              onCancel={handleCancel}
              saveText={customerFollowupMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            />
            <CrudButtons />
          </div>
        </OuterCard>
      </div>
    </div>
  );
}
