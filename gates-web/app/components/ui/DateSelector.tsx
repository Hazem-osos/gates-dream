"use client";

import { useState } from 'react';

interface DateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
}

export function DateSelector({ value, onChange, label, options }: DateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 relative">
      <svg 
        className="w-5 h-5 text-white cursor-pointer" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        onClick={() => setIsOpen(!isOpen)}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
      
      <span className="font-medium text-white min-w-[3rem] text-center">{value}</span>
      
      <svg 
        className="w-5 h-5 text-white cursor-pointer" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        onClick={() => setIsOpen(!isOpen)}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
      
      <span className="text-sm text-white">{label}</span>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-sm z-10 min-w-[4rem]">
          {options.map((option) => (
            <div
              key={option}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-gray-700 text-sm transition-colors"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
