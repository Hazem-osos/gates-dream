"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React from "react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';

function HelpIcon() {
  return (
    <div className="w-12 h-12 bg-[#19506B] rounded-xl flex items-center justify-center">
      <Image src="/ooui_help-ltr.svg" alt="help" width={24} height={24} />
    </div>
  );
}

function CostField({ label, name, value, onChange }: { label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="flex items-center gap-3 w-full max-w-md mx-auto">
      <label className="text-right text-black text-base min-w-[110px]">{label}</label>
      <div className="relative flex-1">
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-[#eaf6fd] rounded-xl border border-[#e3eaf3] px-4 py-2 text-right text-[#7B7B7B] placeholder-[#7B7B7B] text-base outline-none pr-12"
        />
        <span className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg bg-[#e3f0f8]">
          <Image src="/magnifying-glass-1.svg" alt="search" width={20} height={20} />
        </span>
      </div>
    </div>
  );
}

function WordField({ label, name, value, onChange }: { label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="flex items-center gap-3 w-full max-w-md mx-auto">
      <label className="text-right text-black text-base min-w-[110px]">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        className="flex-1 bg-[#f7fafd] rounded-xl border border-[#e3eaf3] px-4 py-2 text-right text-[#7B7B7B] placeholder-[#7B7B7B] text-base outline-none"
      />
    </div>
  );
}

function LocalActionButtons({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex gap-4 mt-10 w-full max-w-md mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 py-4 bg-[#3772D4] text-white text-lg rounded-2xl font-semibold hover:bg-[#285bb2] transition-colors duration-200"
      >
        تراجع
      </button>
      <button
        type="submit"
        className="flex-1 py-4 bg-[#4DBA87] text-white text-lg rounded-2xl font-semibold hover:bg-[#399e6b] transition-colors duration-200"
      >
        حفظ
      </button>
    </div>
  );
}

export default function CostCenterSearchPage() {
  useBackendReachability();

  const router = useRouter();
  const [formData, setFormData] = useState({
    fromCost: "",
    toCost: "",
    replaceWord: "",
    withWord: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <OuterCard>
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <InnerCard>
          <div className="relative bg-white rounded-2xl border border-[#e3eaf3] px-8 pt-8 pb-12 max-w-lg mx-auto w-full shadow-sm">
            {/* Help Icon */}
            <div className="absolute top-6 right-6">
              <HelpIcon />
            </div>
            {/* Page Title */}
            <div className="mb-6">
              <div className="text-right">
                <h1 className="text-xl font-bold text-[#0E78AA] mb-2">بحث مراكز التكلفة</h1>
                <div className="h-1 bg-sky-700 rounded w-full"></div>
              </div>
            </div>
            {/* Form Fields */}
            <form className="flex flex-col gap-6 mt-8">
              <CostField label="من م تكلفة" name="fromCost" value={formData.fromCost} onChange={handleInputChange} />
              <CostField label="إلى م تكلفة" name="toCost" value={formData.toCost} onChange={handleInputChange} />
              <WordField label="تغيير كلمة" name="replaceWord" value={formData.replaceWord} onChange={handleInputChange} />
              <WordField label="بكلمة" name="withWord" value={formData.withWord} onChange={handleInputChange} />
              <LocalActionButtons onBack={() => router.back()} />
            </form>
          </div>
        </InnerCard>
      </div>
    </OuterCard>
  );
} 