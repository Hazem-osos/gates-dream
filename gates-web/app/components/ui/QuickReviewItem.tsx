"use client";

import { useState } from 'react';

interface QuickReviewItemProps {
  title: string;
  hasDropdown?: boolean;
  dropdownValue?: string;
  onDropdownChange?: (value: string) => void;
  dropdownOptions?: string[];
  onClick?: () => void;
  className?: string;
}

export function QuickReviewItem({ 
  title, 
  hasDropdown, 
  dropdownValue, 
  onDropdownChange, 
  dropdownOptions = [],
  className,
}: QuickReviewItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="space-y-3">
      <div className={`bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-[#0E78AA] hover:-translate-y-[1px] transition-all cursor-pointer ${className ?? ''}`}>
        <span className="text-gray-800 text-base md:text-lg font-semibold">
          {title}
        </span>
        
        <div className="flex items-center gap-2">
          {hasDropdown && (
            <select 
              value={dropdownValue}
              onChange={(e) => onDropdownChange?.(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0E78AA] focus:border-[#0E78AA]"
            >
              {dropdownOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          
          <button 
            onClick={toggleExpanded}
            className="text-gray-700 hover:text-gray-900 transition-colors p-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-base"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Expandable Section */}
      {isExpanded && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 ml-4 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 text-base md:text-lg">تفاصيل {title}</h4>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm md:text-base">
              <thead>
                <tr>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">م</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">حساب الصندوق أو البنوك</th>
                  <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                <tr className="even:bg-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-center text-gray-800">1</td>
                  <td className="px-4 py-3 text-center text-gray-800">حساب الصندوق أو البنوك</td>
                  <td className="px-4 py-3 text-center text-gray-800">الرصيد</td>
                </tr>
                <tr className="even:bg-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-center text-gray-800">2</td>
                  <td className="px-4 py-3 text-center text-gray-800">حساب الصندوق أو البنوك</td>
                  <td className="px-4 py-3 text-center text-gray-800">الرصيد</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
