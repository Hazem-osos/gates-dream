'use client';

import type { FrequentCustomerItem } from '@/lib/hooks/useCustomerFrequentItems';

type Props = {
  items: FrequentCustomerItem[];
  loading?: boolean;
  onInsert: (item: FrequentCustomerItem) => void;
};

export function CustomerFrequentItemsBar({ items, loading, onInsert }: Props) {
  if (loading || items.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2">
      <span className="text-xs text-slate-600 font-medium">أصناف متكررة للعميل:</span>
      {items.map((item) => (
        <button
          key={item.itemId}
          type="button"
          onClick={() => onInsert(item)}
          className="text-xs rounded-full border border-[#0E78AA]/40 bg-white px-3 py-1 text-[#0E78AA] hover:bg-[#EAF6FB] transition"
        >
          + {item.arabicName} (آخر سعر: {item.lastUnitPrice.toLocaleString('ar-EG')} ج.م)
        </button>
      ))}
    </div>
  );
}
