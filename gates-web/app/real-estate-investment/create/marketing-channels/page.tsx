"use client";
import Image from "next/image";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React from "react";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import OuterCard from "@/components/OuterCard";
import { ActionButtons } from "@/components/ui/ActionButtons";
import InnerCard from "@/components/InnerCard";

export default function MarketingChannelsPage() {
  useBackendReachability();

  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <div className="w-full max-w-none">
        <h1 className="text-xl font-bold text-[#0E78AA] text-right mb-2">تعريف قنوات التسويق</h1>
        <div className="h-1 bg-sky-700 w-full mb-4"></div>
        <OuterCard>
          <InnerCard>
            {/* Search and Help Buttons */}
            <div className="flex gap-2 mb-6 justify-end">
              <Button className="bg-[rgba(9,76,107,1)]  text-white rounded-lg w-10 h-10 flex items-center justify-center p-0" size="icon" aria-label="بحث">
                <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} />
              </Button>
              <Button className="bg-[rgba(9,76,107,1)]  text-white rounded-lg w-10 h-10 flex items-center justify-center p-0" size="icon" aria-label="مساعدة">
                <Image src="/help.svg" alt="مساعدة" width={20} height={20} />
              </Button>
            </div>
            {/* Form */}
            <form className="grid grid-cols-2 gap-8">
              {/* Row 1: الكود | الإسم العربي */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الكود</label>
                  <input className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" placeholder="إدخل رقم الكود" />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الإسم العربي</label>
                  <input className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" placeholder="إدخل الإسم بالعربي" />
                </div>
              </div>
              {/* Row 2: الإسم الإنجليزي | المدة */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">الإسم الإنجليزي</label>
                  <input className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" placeholder="إدخل الإسم الإنجليزي" />
                </div>
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">المدة</label>
                  <input className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" placeholder="إدخل المدة" />
                </div>
              </div>
              {/* Row 3: منطقة الإعلان */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[#094C6B] font-medium mb-1">منطقة الإعلان</label>
                  <input className="w-full bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-black text-base focus:outline-none" placeholder="إدخل منطقة الإعلان" />
                </div>
              </div>
            </form>
          </InnerCard>
          {/* Action Buttons */}
          <div className="flex gap-4 mt-16 justify-between flex-row-reverse">
            <ActionButtons />
            <CrudButtons />
          </div>
        </OuterCard>
      </div>
    </div>
  );
}
