'use client';

import { useMemo, useState } from 'react';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { Button, SearchIcon } from '@/components/ui';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { WarehousesListSection, type WarehouseRow } from '@/components/inventory/WarehousesListSection';
import { warehouseCanBranch } from '@/lib/inventory/warehouse-kind';

export function WarehouseParentField({
  value,
  onChange,
  excludeIds,
  disabled,
}: {
  value: string;
  onChange: (parentWarehouseId: string) => void;
  excludeIds?: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const blocked = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const close = () => setOpen(false);

  const pick = (parentWarehouseId: string) => {
    onChange(parentWarehouseId);
    close();
  };

  const handleSelect = (row: WarehouseRow) => {
    if (blocked.has(row.id)) return;
    if (!warehouseCanBranch(row.warehouseKind, row.parentWarehouseId)) return;
    pick(row.id);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <WarehouseSelect
            value={value}
            onChange={onChange}
            emptyLabel="المخزن الأب"
            headerOnly
            excludeIds={excludeIds}
            disabled={disabled}
            enableQuickCreate={false}
          />
        </div>
        <button
          type="button"
          title="عدسة المخزن الأب"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#0E79AA] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SearchIcon />
        </button>
      </div>
      <MasterEntitySideDrawer
        open={open}
        onClose={close}
        title="عدسة المخزن الأب"
        subtitle="حدّد المخزن اللي هينزل تحته، أو انقله لمخزن تاني. مخزن العمليات مش بيتفرّع منه."
        footer={
          <Button type="button" variant="secondary" fullWidth onClick={close}>
            خروج
          </Button>
        }
      >
        <button
          type="button"
          className="mb-3 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-right text-sm font-semibold text-[#094C6B] hover:bg-white"
          onClick={() => pick('')}
        >
          المخزن الأب
        </button>
        <WarehousesListSection
          headerOnly
          excludeIds={excludeIds}
          selectedId={value || null}
          onSelect={handleSelect}
        />
      </MasterEntitySideDrawer>
    </>
  );
}
