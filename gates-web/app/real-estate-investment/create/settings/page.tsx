"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React from "react";
import OuterCard from "@/components/OuterCard";
import InnerCard from "@/components/InnerCard";
import { ActionButtons } from "@/components/ui/ActionButtons";

export default function RealEstateSettings() {
  useBackendReachability();

  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <div className="w-full max-w-none">
        <OuterCard>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#0E78AA] text-right mb-2">
              إعدادات الإستثمار العقاري
            </h1>
            <div className="h-1 bg-sky-700 w-full"></div>
          </div>
          <InnerCard>
            {/* Form */}
            <div className="space-y-6">
              {/* Group Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">المجموعة</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="1010101"
                      className="flex-1 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                      readOnly
                    />
                  </div>
                  <div className="mt-2">
                    <span className="inline-block bg-blue-100 text-[#0E78AA] px-3 py-1 rounded-full text-sm">
                      الألوان والمواد المساعدة
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">تحذير المتابعة</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="إدخل عدد الأيام بالأرقام"
                      className="flex-1 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                    />
                    <span className="bg-[#EAF6FB] text-[#094C6B] px-4 py-2 rounded-lg border border-[#D6EAF3] flex items-center">
                      يوم
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">تحذير المعاينة</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="إدخل عدد الأيام بالأرقام"
                      className="flex-1 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                    />
                    <span className="bg-[#EAF6FB] text-[#094C6B] px-4 py-2 rounded-lg border border-[#D6EAF3] flex items-center">
                      يوم
                    </span>
                  </div>
                </div>
              </div>

              {/* Other Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">أخرى 1</label>
                  <input
                    type="number"
                    placeholder="إدخل العدد"
                    className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">أخرى 2</label>
                  <input
                    type="number"
                    placeholder="إدخل العدد"
                    className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">أخرى 3</label>
                  <input
                    type="number"
                    placeholder="إدخل العدد"
                    className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                  />
                </div>
              </div>

              {/* Area Deviation Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">إنحراف المساحة +</label>
                  <input
                    type="number"
                    placeholder="إدخل العدد"
                    className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[#094C6B] font-medium mb-2 text-right">إنحراف المساحة -</label>
                  <input
                    type="number"
                    placeholder="إدخل العدد"
                    className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#0E78AA] text-black"
                  />
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex justify-end mt-8">
              <ActionButtons />
            </div>
          </InnerCard>
        </OuterCard>
      </div>
    </div>
  );
} 