'use client';
import React from 'react';
import Image from 'next/image';

const ICON_VENDOR =
  'https://cdn.builder.io/api/v1/image/assets/fe9be9eb627e4454b2764886891f3b89/9d40086d911425aa4e22e5deb076ac39dfc0b20c?placeholderIfAbsent=true';
const ICON_STORE =
  'https://cdn.builder.io/api/v1/image/assets/fe9be9eb627e4454b2764886891f3b89/e03f7e7966bd87750be699a286e63c260ea20866?placeholderIfAbsent=true';
const ICON_COST =
  'https://cdn.builder.io/api/v1/image/assets/fe9be9eb627e4454b2764886891f3b89/817311d0bb9db176de5e65f94570a3d28dfd62e9?placeholderIfAbsent=true';

export const FormControls = () => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center">
        <div className="flex flex-col justify-center self-stretch px-4 py-2 my-auto bg-gray-50 rounded-lg border border-solid border-[color:var(--Highlight,#D6EAF3)] min-w-60 text-slate-400 w-[379px]">
          <input
            type="text"
            placeholder="إدخل الإسم"
            className="gap-4 w-full min-h-5 text-slate-400 bg-transparent border-none outline-none"
          />
        </div>
        <label className="gap-2 self-stretch px-4 py-3 my-auto whitespace-nowrap min-h-9 text-zinc-800 w-[100px]">
          الإسم
        </label>
      </div>

      <div className="flex items-center">
        <div className="flex items-center self-stretch my-auto min-w-60 text-slate-400 w-[377px]">
          <Image src={ICON_VENDOR} alt="" width={36} height={36} className="object-contain shrink-0 self-stretch my-auto w-9 h-9" />
          <div className="flex flex-col flex-1 shrink justify-center self-stretch px-4 py-2 my-auto bg-gray-50 rounded-none border-t border-r border-b border-solid basis-0 border-b-[color:var(--Highlight,#D6EAF3)] border-r-[color:var(--Highlight,#D6EAF3)] border-t-[color:var(--Highlight,#D6EAF3)] min-w-60">
            <input
              type="text"
              placeholder="إدخل إسم المورد"
              className="gap-2 w-full min-h-5 text-slate-400 bg-transparent border-none outline-none"
            />
          </div>
        </div>
        <label className="gap-2 self-stretch px-4 py-3 my-auto whitespace-nowrap min-h-9 text-zinc-800 w-[100px]">
          المورد
        </label>
      </div>

      <div className="flex items-center">
        <div className="flex items-center self-stretch my-auto min-w-60 text-slate-400 w-[377px]">
          <Image src={ICON_STORE} alt="" width={36} height={36} className="object-contain shrink-0 self-stretch my-auto w-9 h-9" />
          <div className="flex flex-col flex-1 shrink justify-center self-stretch px-4 py-2 my-auto bg-gray-50 rounded-none border-t border-r border-b border-solid basis-0 border-b-[color:var(--Highlight,#D6EAF3)] border-r-[color:var(--Highlight,#D6EAF3)] border-t-[color:var(--Highlight,#D6EAF3)] min-w-60">
            <input
              type="text"
              placeholder="إدخل إسم المخزن"
              className="gap-2 w-full min-h-5 text-slate-400 bg-transparent border-none outline-none"
            />
          </div>
        </div>
        <label className="gap-2 self-stretch px-4 py-3 my-auto whitespace-nowrap min-h-9 text-zinc-800 w-[100px]">
          المخزن
        </label>
      </div>

      <div className="flex items-center">
        <div className="flex items-center self-stretch my-auto min-w-60 text-slate-400 w-[377px]">
          <Image src={ICON_COST} alt="" width={36} height={36} className="object-contain shrink-0 self-stretch my-auto w-9 h-9" />
          <div className="flex flex-col flex-1 shrink justify-center self-stretch px-4 py-2 my-auto bg-gray-50 rounded-none border-t border-r border-b border-solid basis-0 border-b-[color:var(--Highlight,#D6EAF3)] border-r-[color:var(--Highlight,#D6EAF3)] border-t-[color:var(--Highlight,#D6EAF3)] min-w-60">
            <input
              type="text"
              placeholder="إدخل مركز التكلفة"
              className="gap-2 w-full min-h-5 text-slate-400 bg-transparent border-none outline-none"
            />
          </div>
        </div>
        <label className="gap-2 self-stretch px-2 py-3 my-auto min-h-9 text-zinc-800 w-[100px]">
          مركز التكلفة
        </label>
      </div>
    </div>
  );
};
