"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React from "react";
import Image from "next/image";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import OuterCard from "@/components/OuterCard";
import { ActionButtons } from "@/components/ui/ActionButtons";
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
} from "@/components/ui";

const radioClass =
  "inline-flex cursor-pointer items-center rounded-full border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] has-[:checked]:border-[#0E78AA] has-[:checked]:bg-[#0E78AA] has-[:checked]:text-white";

export default function UnitSaleOthers() {
  useBackendReachability();

  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <div className="w-full max-w-none">
        <h1 className="mb-2 text-right text-xl font-bold text-[#0E78AA]">تعريف وحدة للبيع للغير</h1>
        <div className="mb-4 h-1 w-full bg-sky-700"></div>
        <div className="mb-6 flex justify-end gap-2">
          <Button className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E78AA] p-0 text-white hover:bg-blue-800" size="icon" aria-label="بحث">
            <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} />
          </Button>
          <Button className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E78AA] p-0 text-white hover:bg-blue-800" size="icon" aria-label="مساعدة">
            <Image src="/help.svg" alt="مساعدة" width={20} height={20} />
          </Button>
        </div>
        <OuterCard>
          <div className="mb-6 flex gap-2">
            <Button variant="outline" className="bg-[#EAF6FB] px-8 py-2 font-bold text-[#0E78AA] border-[#0E78AA]">أرشفة</Button>
            <Button variant="outline" className="bg-[#EAF6FB] px-8 py-2 font-bold text-[#0E78AA] border-[#0E78AA]"> ترحيل للبيع</Button>
          </div>
          <form>
            <FormSectionCard title="البيانات الأساسية" subtitle="هوية الوحدة والمساحات وسعر البيع" icon={Home}>
              <CompactFormField label="الإسم العربي" placeholder="إدخل الإسم بالعربي" />
              <CompactFormField label="الكود" placeholder="إدخل رقم الكود" />
              <CompactFormField label="عنوان الوحدة" placeholder="إدخل عنوان الوحدة" />
              <CompactFormField label="المساحة" placeholder="إدخل المساحة بالارقام" />
              <CompactFormField label="عدد الغرف" placeholder="إدخل العدد بالارقام" />
              <CompactFormField label="الدور" placeholder="إدخل الدور بالارقام" />
              <CompactFormField label="عدد الحمامات" placeholder="إدخل العدد بالارقام" />
              <CompactFormField label="المالك" placeholder="إدخل الإسم بالعربي" />
              <CompactFormField label="سعر البيع" placeholder="0,00" />
              <CompactFormField label="نوع المعاملة" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <label className={radioClass}>
                    <input type="radio" name="dealType" className="sr-only" defaultChecked />
                    بيع للغير
                  </label>
                  <label className={radioClass}>
                    <input type="radio" name="dealType" className="sr-only" />
                    إعادة بيع
                  </label>
                </div>
              </CompactFormField>
              <CompactFormField label="نوع الدفع" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <label className={radioClass}>
                    <input type="radio" name="payType" className="sr-only" defaultChecked />
                    كاش
                  </label>
                  <label className={radioClass}>
                    <input type="radio" name="payType" className="sr-only" />
                    قسط
                  </label>
                </div>
              </CompactFormField>
            </FormSectionCard>

            <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <CompactFormField label="تليفون 1" placeholder="إدخل رقم التليفون" />
                <CompactFormField label="تليفون 2" placeholder="إدخل رقم التليفون" />
                <CompactFormField label="العنوان" placeholder="إدخل العنوان" />
                <CompactFormField label="الإيميل" placeholder="إدخل البريد الإلكتروني" />
                <CompactFormField label="عدد السنوات" placeholder="0,00" />
                <CompactFormField label="الإجمالي" placeholder="0,00" />
                <CompactFormField label="الواجهة" placeholder="0,00" />
                <CompactFormField label="دفعة مقدمة" placeholder="0,00" />
                <CompactFormField label="دفعة سنوية" placeholder="0,00" />
                <CompactFormField label="عدد الشهور" placeholder="إدخل العدد بالارقام" />
                <CompactFormField label="رقم الوحدة" placeholder="0,00" />
                <CompactFormField label="سعر المتر" placeholder="0,00" />
                <CompactFormField label="التشطيب" className="sm:col-span-2 lg:col-span-3">
                  <div className="flex flex-wrap gap-2">
                    <label className={radioClass}>
                      <input type="radio" name="finishType" className="sr-only" defaultChecked />
                      تشطيب كامل
                    </label>
                    <label className={radioClass}>
                      <input type="radio" name="finishType" className="sr-only" />
                      نصف تشطيب
                    </label>
                    <label className={radioClass}>
                      <input type="radio" name="finishType" className="sr-only" />
                      بدون
                    </label>
                  </div>
                </CompactFormField>
                <CompactFormField label="الإستلام" className="sm:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <label className={radioClass}>
                      <input type="radio" name="deliveryType" className="sr-only" defaultChecked />
                      إستلام فوري
                    </label>
                    <label className={radioClass}>
                      <input type="radio" name="deliveryType" className="sr-only" />
                      إستلام لاحق
                    </label>
                  </div>
                </CompactFormField>
              </div>
            </AdvancedFieldsSection>
          </form>
          <div className="mt-8 flex justify-between gap-4">
            <CrudButtons />
            <div className="flex gap-2">
              <Button className="min-h-[52px] w-[182px] rounded-lg bg-[#CB5B53] px-3 py-3.5 text-white shadow-sm transition-colors duration-200 hover:bg-red-700" size="lg">إلغاء الحجز</Button>
              <ActionButtons />
            </div>
          </div>
        </OuterCard>
      </div>
    </div>
  );
}
