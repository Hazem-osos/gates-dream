import React from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';

const MAGNIFY_SRC = '/magnifying-glass%201.svg';

export type ProjectHeaderForm = {
  serial: string;
  arabicName: string;
  englishName: string;
  address: string;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  duration: string;
  startDate: string;
  startDateHijri: string;
};

type ProjectHeaderProps = {
  value: ProjectHeaderForm;
  onChange: (patch: Partial<ProjectHeaderForm>) => void;
  readOnlyIdentity?: boolean;
  onNewProject?: () => void;
};

const ProjectHeader = ({
  value,
  onChange,
  readOnlyIdentity = false,
  onNewProject,
}: ProjectHeaderProps) => (
  <div className="bg-white rounded-2xl border border-[#E6F0F7] p-6 mb-6">
    <div className="flex flex-row-reverse items-center mb-4 gap-3">
      {onNewProject ? (
        <button
          type="button"
          onClick={onNewProject}
          className="ml-auto px-6 py-2 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg text-[#0E78AA] font-bold shadow hover:bg-[#E3F6FC] transition-all"
        >
          مشروع جديد
        </button>
      ) : (
        <button
          type="button"
          className="ml-auto px-6 py-2 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg text-[#0E78AA] font-bold shadow hover:bg-[#E3F6FC] transition-all"
        >
          أرشفة مستندات
        </button>
      )}
    </div>
    <div className="grid grid-cols-2 gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 items-center flex-row-reverse">
          <Input
            placeholder="إدخل الإسم الإنجليزي"
            className="bg-[#F6FBFD] text-right flex-1"
            value={value.englishName}
            onChange={(e) => onChange({ englishName: e.target.value })}
          />
          <label className="w-32 text-zinc-800 text-right">الإسم الإنجليزي</label>
        </div>
        <div className="flex gap-2 items-center flex-row-reverse">
          <Input
            placeholder="إدخل المدة الزمنية"
            className="bg-[#F6FBFD] text-right flex-1"
            value={value.duration}
            onChange={(e) => onChange({ duration: e.target.value })}
          />
          <label className="w-32 text-zinc-800 text-right">المدة الزمنية</label>
        </div>
        <div className="flex gap-4 items-center flex-row-reverse">
          <div className="flex gap-2 items-center flex-row-reverse flex-1">
            <div className="flex items-center bg-[#F6FBFD] rounded-md w-full flex-1">
              <button type="button" className="px-2">
                <Image src={MAGNIFY_SRC} alt="" width={20} height={20} unoptimized className="w-5 h-5" />
              </button>
              <Input
                placeholder="الهجري"
                className="bg-[#F6FBFD] border-none text-right flex-1"
                value={value.startDateHijri}
                onChange={(e) => onChange({ startDateHijri: e.target.value })}
              />
            </div>
            <label className="w-24 text-zinc-800 text-right">الهجري</label>
          </div>
          <div className="flex gap-2 items-center flex-row-reverse flex-1">
            <div className="flex items-center bg-[#F6FBFD] rounded-md w-full flex-1">
              <button type="button" className="px-2">
                <Image src={MAGNIFY_SRC} alt="" width={20} height={20} unoptimized className="w-5 h-5" />
              </button>
              <Input
                placeholder="تاريخ البدء"
                className="bg-[#F6FBFD] border-none text-right flex-1"
                value={value.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
              />
            </div>
            <label className="w-24 text-zinc-800 text-right">تاريخ البدء</label>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-row-reverse">
          <Input
            placeholder="إدخل رقم تليفون العميل"
            className="bg-[#F6FBFD] text-right flex-1"
            value={value.customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })}
          />
          <label className="w-32 text-zinc-800 text-right">ت. العميل</label>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 items-center flex-row-reverse">
          <Input
            placeholder="رقم المشروع"
            className="bg-[#F6FBFD] text-right flex-1"
            readOnly={readOnlyIdentity}
            value={value.serial}
            onChange={(e) => onChange({ serial: e.target.value })}
          />
          <label className="w-32 text-zinc-800 text-right">رقم المشروع</label>
        </div>
        <div className="flex gap-2 items-center flex-row-reverse">
          <Input
            placeholder="الإسم العربي"
            className="bg-[#F6FBFD] text-right flex-1"
            value={value.arabicName}
            onChange={(e) => onChange({ arabicName: e.target.value })}
          />
          <label className="w-32 text-zinc-800 text-right">الإسم العربي</label>
        </div>
        <div className="flex gap-2 items-center flex-row-reverse">
          <Input
            placeholder="إدخل العنوان"
            className="bg-[#F6FBFD] text-right flex-1"
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
          <label className="w-32 text-zinc-800 text-right">العنوان</label>
        </div>
        <div className="flex gap-2 items-center flex-row-reverse">
          <div className="flex items-center bg-[#F6FBFD] rounded-md w-full flex-1 gap-2">
            <Input
              placeholder="كود العميل"
              className="bg-[#F6FBFD] border-none text-right w-28"
              value={value.customerCode}
              onChange={(e) => onChange({ customerCode: e.target.value })}
            />
            <Input
              placeholder="إسم العميل"
              className="bg-[#F6FBFD] border-none text-right flex-1"
              value={value.customerName}
              onChange={(e) => onChange({ customerName: e.target.value })}
            />
          </div>
          <label className="w-32 text-zinc-800 text-right">العميل</label>
        </div>
      </div>
    </div>
  </div>
);

export default ProjectHeader;
