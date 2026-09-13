'use client';

import { Button } from './ui/button';

interface CheckQuantitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Sample data for the quantities table
const quantitiesData = [
  { id: 1, item: '', requiredQuantity: '', warehouseQuantity: '' },
  { id: 2, item: '', requiredQuantity: '', warehouseQuantity: '' },
  { id: 3, item: '', requiredQuantity: '', warehouseQuantity: '' },
  { id: 4, item: '', requiredQuantity: '', warehouseQuantity: '' },
  { id: 5, item: '', requiredQuantity: '', warehouseQuantity: '' },
];

export default function CheckQuantitiesModal({ isOpen, onClose }: CheckQuantitiesModalProps) {
  const quantities = quantitiesData;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4" style={{ direction: 'rtl' }}>
        {/* Modal Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-black">فحص كميات</h2>
        </div>

        {/* Table */}
        <div className="mb-6">
          <div className="bg-white border border-[#E6F0F7] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-sky-700 text-white font-bold">
                  <th className="py-4 px-4 text-sm text-center">الصنف</th>
                  <th className="py-4 px-4 text-sm text-center">الكمية المطلوبة</th>
                  <th className="py-4 px-4 text-sm text-center">الكمية في المخازن</th>
                </tr>
              </thead>
              <tbody>
                {quantities.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#F6FBFD]'}>
                    <td className="py-3 px-4 border-l border-[#E6F0F7]">
                     
                    </td>
                    <td className="py-3 px-4 border-l border-[#E6F0F7]">
                      
                    </td>
                    <td className="py-3 px-4 border-l border-[#E6F0F7]">
                     
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button 
            onClick={onClose}
            className="bg-[#0E78AA] hover:bg-[#094C6B] text-white px-8 py-3 text-lg font-medium"
          >
            تراجع
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-medium"
          >
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
} 