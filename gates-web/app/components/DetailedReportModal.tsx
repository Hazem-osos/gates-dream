"use client";

import React from 'react';

interface DetailedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: Array<{
    id: number;
    account: string;
    balance: string;
  }>;
}

export const DetailedReportModal: React.FC<DetailedReportModalProps> = ({
  isOpen,
  onClose,
  title,
  data
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ direction: 'rtl' }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-[#0E78AA]">{title}</h2>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">الرصيد</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">حساب الصندوق أو البنوك</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md">م</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-4 py-3 text-gray-700">{item.balance}</td>
                  <td className="px-4 py-3 text-gray-700">{item.account}</td>
                  <td className="px-4 py-3 text-gray-700 text-center">{item.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            إغلاق
          </button>
          <button className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#0C5A7A] transition-colors">
            تصدير
          </button>
        </div>
      </div>
    </div>
  );
};
