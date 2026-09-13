'use client';
import React from 'react';
import Image from 'next/image';

const ICON_CAL_HJ =
  'https://cdn.builder.io/api/v1/image/assets/fe9be9eb627e4454b2764886891f3b89/31a1166cd5a302bce07eca2a9ddfab9c7de3f5fe?placeholderIfAbsent=true';
const ICON_CAL_GREG =
  'https://cdn.builder.io/api/v1/image/assets/fe9be9eb627e4454b2764886891f3b89/64433c537bbafa2e6cfcc1d1e38c89f9eb23b220?placeholderIfAbsent=true';
const ICON_CHEVRON =
  'https://cdn.builder.io/api/v1/image/assets/fe9be9eb627e4454b2764886891f3b89/0299b6bcae16f1831f359c15c96331805516bff7?placeholderIfAbsent=true';

export const DateInputs = () => {
  return (
    <div className="flex flex-wrap gap-6 items-start text-sm font-medium text-right">
      <div className="flex items-center whitespace-nowrap min-w-60">
        <div className="flex items-center self-stretch my-auto leading-none text-slate-400">
          <Image src={ICON_CAL_HJ} alt="" width={36} height={36} className="object-contain shrink-0 self-stretch my-auto w-9 h-9" />
          <div className="flex flex-col justify-center self-stretch px-4 py-2 my-auto bg-gray-50 rounded-none border-t border-r border-b border-solid border-b-[color:var(--Highlight,#D6EAF3)] border-r-[color:var(--Highlight,#D6EAF3)] border-t-[color:var(--Highlight,#D6EAF3)] w-[168px]">
            <div className="flex gap-2 items-end w-full min-h-5">
              <span className="text-slate-400">26-11-2025</span>
              <Image src={ICON_CHEVRON} alt="" width={16} height={16} className="object-contain shrink-0 w-4 h-4" />
            </div>
          </div>
        </div>
        <label className="gap-2 self-stretch px-4 py-3 my-auto leading-none min-h-9 text-zinc-800">
          الهجري
        </label>
      </div>
      <div className="flex items-center min-w-60">
        <div className="flex items-center self-stretch my-auto leading-none whitespace-nowrap text-slate-400">
          <Image src={ICON_CAL_GREG} alt="" width={36} height={36} className="object-contain shrink-0 self-stretch my-auto w-9 h-9" />
          <div className="flex flex-col justify-center self-stretch px-4 py-2 my-auto bg-gray-50 rounded-none border-t border-r border-b border-solid border-b-[color:var(--Highlight,#D6EAF3)] border-r-[color:var(--Highlight,#D6EAF3)] border-t-[color:var(--Highlight,#D6EAF3)] w-[168px]">
            <div className="flex gap-2 items-end w-full min-h-5">
              <span className="text-slate-400">26-11-2025</span>
              <Image src={ICON_CHEVRON} alt="" width={16} height={16} className="object-contain shrink-0 w-4 h-4" />
            </div>
          </div>
        </div>
        <label className="gap-2 self-stretch px-4 py-3 my-auto leading-none min-h-9 text-zinc-800 w-[100px]">
          من تاريخ
        </label>
      </div>
    </div>
  );
};
