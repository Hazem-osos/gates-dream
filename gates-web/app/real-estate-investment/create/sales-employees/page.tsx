"use client";
import Image from "next/image";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React from "react";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import OuterCard from "@/components/OuterCard";
import { ActionButtons } from "@/components/ui/ActionButtons";

export default function SalesEmployees() {
  useBackendReachability();

  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <div className="w-full max-w-none">
        <h1 className="text-xl font-bold text-[#0E78AA] text-right mb-2">تعريف موظفي المبيعات</h1>
        <div className="h-1 bg-sky-700 w-full mb-4"></div>
        {/* Only Search and Help Buttons */}
        <div className="flex gap-2 mb-6 justify-end">
          <Button className="bg-[#0E78AA] hover:bg-blue-800 text-white rounded-lg w-10 h-10 flex items-center justify-center p-0" size="icon" aria-label="بحث">
            <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} />
          </Button>
          <Button className="bg-[#0E78AA] hover:bg-blue-800 text-white rounded-lg w-10 h-10 flex items-center justify-center p-0" size="icon" aria-label="مساعدة">
            <Image src="/help.svg" alt="مساعدة" width={20} height={20} />
          </Button>
        </div>
        <OuterCard>
          {/* Form */}
          <form className="grid grid-cols-2 gap-8">
            {/* Right column */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">الكود</label>
                <input className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" placeholder="إدخل رقم الكود" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">الإسم العربي</label>
                <input className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" placeholder="إدخل الإسم بالعربي" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">تليفون 1</label>
                <input className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" placeholder="إدخل رقم التليفون" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">تليفون 2</label>
                <input className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" placeholder="إدخل رقم التليفون" />
              </div>
       
              <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">النوع</label>
                <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                  <option value="">اختر النوع</option>
                  <option value="داخلي">داخلي</option>
                  <option value="خارجي">خارجي</option>
                </select>
              </div>
              {/* المستخدم row */}
              <div className="flex items-center gap-2 mt-2">
              <label htmlFor="allClients" className="text-[#094C6B] font-medium"> المستخدم  </label>

                <input type="text" value="1010101" className="w-32 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right text-[#0E78AA] font-bold focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-lg" style={{ direction: 'ltr' }} readOnly />
                <span className="inline-block bg-blue-100 text-[#0E78AA] px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">الألوان والمواد المساعدة</span>
              </div>
              {/* Checkbox */}
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="allClients" className="w-5 h-5 accent-[#0E78AA]" />
                <label htmlFor="allClients" className="text-[#094C6B] font-medium">الإطلاع على جميع العملاء</label>
              </div>
            </div>
            {/* Left column */}
            <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">الجنس</label>
                <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                  <option value="">اختر الجنس</option>
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#094C6B] font-medium">الإسم الإنجليزي</label>
                <input className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" placeholder="إدخل الإسم الإنجليزي" />
              </div>

            </div>
          </form>
          {/* Action Buttons */}
          <div className="flex gap-4  mt-8 justify-between">
            <CrudButtons />
            <div className="flex gap-2">
              <ActionButtons />
            </div>
          </div>
        </OuterCard>
      </div>
    </div>
  );
}
