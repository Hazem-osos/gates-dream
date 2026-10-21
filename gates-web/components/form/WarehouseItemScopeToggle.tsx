'use client';

import { useWarehouseItemScope } from '@/lib/inventory/warehouse-item-scope';
import { cn } from '@/lib/utils';

export function WarehouseItemScopeToggle({ className }: { className?: string }) {
  const [scope, setScope] = useWarehouseItemScope();
  return (
    <div className={cn('mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-[#094C6B]', className)}>
      <label className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          type="radio"
          name="warehouse-item-scope"
          className="accent-[#0E78AA]"
          checked={scope === 'linked'}
          onChange={() => setScope('linked')}
        />
        أصناف هذا المخزن
      </label>
      <label className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          type="radio"
          name="warehouse-item-scope"
          className="accent-[#0E78AA]"
          checked={scope === 'all'}
          onChange={() => setScope('all')}
        />
        كل الأصناف
      </label>
    </div>
  );
}
