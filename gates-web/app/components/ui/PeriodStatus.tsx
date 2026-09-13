"use client";
import React from 'react';

export const PeriodStatus = () => {
  return (
    <section className="flex gap-6 items-center self-stretch my-auto text-sm font-medium leading-none">
      <div className="flex items-center self-stretch my-auto">
        <div className="gap-2 self-stretch px-4 py-3 my-auto text-center text-green-400 whitespace-nowrap rounded-lg bg-green-400 bg-opacity-30 min-h-9 w-[100px]">
          مفتوحة
        </div>
        <h3 className="gap-2 self-stretch px-4 py-3 my-auto text-right min-h-9 text-zinc-800">
          حالة الفترة المالية
        </h3>
      </div>
    </section>
  );
};