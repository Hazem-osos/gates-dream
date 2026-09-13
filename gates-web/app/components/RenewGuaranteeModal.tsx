'use client';

import { FormStickyFooter } from '@/components/ui';

interface RenewGuaranteeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RenewGuaranteeModal({ isOpen, onClose }: RenewGuaranteeModalProps) {
  const renewalData = [
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
    { date: '22-2-2025', serial: '00000000001' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl" style={{ direction: 'rtl' }}>
        <div className="p-8 pb-0">
          <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-[#0E78AA]"></div>
              <h2 className="text-xl font-bold text-[#0E78AA]">تجديدات خطاب الضمان</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-[#0E78AA] to-[#094C6B] text-white">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-semibold">المسلسل</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {renewalData.map((item, index) => (
                    <tr key={index} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">{item.serial}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <FormStickyFooter
          onCancel={onClose}
          onSave={onClose}
          cancelText="تراجع"
          saveText="حفظ"
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
