"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React from "react";
import Image from "next/image";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import OuterCard from "@/components/OuterCard";
import { ActionButtons } from "@/components/ui/ActionButtons";
import UnitDetailsDrawer from "@/components/UnitDetailsDrawer";
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
} from "@/components/ui";

/** Stable demo counts (avoid Math.random during render → hydration mismatch). */
const DEMO_FLOOR_UNIT_COUNTS = [3, 5, 2, 8, 4, 6, 1] as const;

const radioClass =
  "inline-flex cursor-pointer items-center rounded-full border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] has-[:checked]:border-[#0E78AA] has-[:checked]:bg-[#0E78AA] has-[:checked]:text-white";

export default function UnitSalePrivate() {
  useBackendReachability();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <UnitDetailsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <h2 className="mb-8 text-center text-2xl font-bold text-[#094C6B]">الأدوار</h2>
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[#D6EAF3] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-[#0E78AA]">نوع الأدوار</h3>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 rounded-lg p-2 text-[#094C6B] transition-colors duration-200 hover:bg-[#F6FBFD]">
                <input type="checkbox" className="h-5 w-5 rounded-md accent-[#0E78AA]" defaultChecked />
                <span className="text-base font-medium">أرضي منخفض</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg p-2 text-[#094C6B] transition-colors duration-200 hover:bg-[#F6FBFD]">
                <input type="checkbox" className="h-5 w-5 rounded-md accent-[#0E78AA]" defaultChecked />
                <span className="text-base font-medium">أرضي</span>
              </label>
              <div className="flex items-center gap-3 rounded-lg bg-[#F6FBFD] p-2">
                <label className="flex items-center gap-3 text-[#094C6B]">
                  <input type="checkbox" className="h-5 w-5 rounded-md accent-[#0E78AA]" defaultChecked />
                  <span className="text-base font-medium">دور</span>
                </label>
                <span className="mr-2 text-base font-medium text-[#0E78AA]">العدد</span>
                <input type="number" className="w-24 rounded-lg border border-[#B6D6EA] bg-white px-3 py-2 text-right text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E78AA]" placeholder="إدخل العدد" />
              </div>
              <label className="flex items-center gap-3 rounded-lg p-2 text-[#094C6B] transition-colors duration-200 hover:bg-[#F6FBFD]">
                <input type="checkbox" className="h-5 w-5 rounded-md accent-[#0E78AA]" />
                <span className="text-base font-medium">روف</span>
              </label>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-sm">
            <div className="border-b border-[#D6EAF3] bg-[#F0F7FB] p-4">
              <h3 className="text-center text-lg font-semibold text-[#094C6B]">تفاصيل الأدوار</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#EAF6FB]">
                    <th className="py-2 text-right text-xs font-semibold text-[#094C6B]">الدور</th>
                    <th className="py-2 text-center text-xs font-semibold text-[#094C6B]">عدد الوحدات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6FBFD]">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <tr key={i} className="transition-colors duration-200 hover:bg-[#F6FBFD]">
                      <td className="py-2 text-right text-xs font-medium text-[#094C6B]">الدور {i + 1}</td>
                      <td className="py-2 text-center text-xs font-semibold text-[#0E78AA]">{DEMO_FLOOR_UNIT_COUNTS[i] ?? 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </UnitDetailsDrawer>
      <div className={`w-full max-w-none transition-all duration-300 ease-in-out ${drawerOpen ? 'ml-[250px]' : 'ml-0'}`}>
        <h1 className="mb-2 text-right text-xl font-bold text-[#0E78AA]">تعريف وحدة للبيع خاصة</h1>
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
            <Button variant="outline" className="bg-[#EAF6FB] px-8 py-2 font-bold text-[#0E78AA] border-[#0E78AA]" onClick={() => setDrawerOpen(true)}>تفاصيل الوحدة</Button>
            <Button variant="outline" className="bg-[#EAF6FB] px-8 py-2 font-bold text-[#0E78AA] border-[#0E78AA]">ترحيل للبيع</Button>
          </div>
          <form>
            <FormSectionCard title="البيانات الأساسية" subtitle="كود الوحدة والاسم والموقع ونوع الدفع" icon={Home}>
              <CompactFormField label="الكود" placeholder="إدخل رقم الكود" />
              <CompactFormField label="الإسم العربي" placeholder="إدخل الإسم بالعربي" />
              <CompactFormField label="المشروع" />
              <CompactFormField label="العمارة" />
              <CompactFormField label="عنوان الوحدة" placeholder="إدخل عنوان الوحدة" />
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
                <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الإسم الإنجليزي" />
                <CompactFormField label="المنطقة" />
                <CompactFormField label="الحي" />
                <CompactFormField label="دفعة مقدمة" placeholder="0,00" />
                <CompactFormField label="دفعة سنوية" placeholder="0,00" />
                <CompactFormField label="أخرى 1" placeholder="إدخل العدد" />
                <CompactFormField label="أخرى 2" placeholder="إدخل العدد" />
                <CompactFormField label="أخرى 3" placeholder="إدخل العدد" />
                <CompactFormField label="إنحراف المساحة +" placeholder="إدخل العدد" />
                <CompactFormField label="إنحراف المساحة -" placeholder="إدخل العدد" />
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
