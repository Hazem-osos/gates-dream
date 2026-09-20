export type WarehouseKind = 'HEADER' | 'POSTING';

export function warehouseRoleLabel(input: {
  warehouseKind?: string | null;
  parentWarehouseId?: string | null;
  storeType?: string | null;
}): string {
  if (input.warehouseKind === 'POSTING') return 'عمليات';
  if (input.warehouseKind === 'HEADER') {
    return input.parentWarehouseId || input.storeType === 'SUB' ? 'رئيسي فرعي' : 'رئيسي';
  }
  if (input.parentWarehouseId || input.storeType === 'SUB') return 'عمليات';
  return 'رئيسي';
}

export function warehouseCanBranch(
  warehouseKind?: string | null,
  parentWarehouseId?: string | null
): boolean {
  if (warehouseKind === 'POSTING') return false;
  if (warehouseKind === 'HEADER') return true;
  return !parentWarehouseId;
}

type WarehouseAccountSource = {
  id: string;
  parentWarehouseId?: string | null;
  inventoryAccountId?: string | null;
  costAccountId?: string | null;
};

/** Walk up parents until inventory/cost accounts are found. Empty fields stay empty. */
export function inheritWarehouseAccounts(
  rows: WarehouseAccountSource[],
  parentId: string | null | undefined
): { inventoryAccountId: string; costAccountId: string } {
  let currentId = parentId?.trim() ?? '';
  const seen = new Set<string>();
  let inventoryAccountId = '';
  let costAccountId = '';
  while (currentId && !seen.has(currentId) && (!inventoryAccountId || !costAccountId)) {
    seen.add(currentId);
    const parent = rows.find((row) => row.id === currentId);
    if (!parent) break;
    if (!inventoryAccountId && parent.inventoryAccountId) inventoryAccountId = parent.inventoryAccountId;
    if (!costAccountId && parent.costAccountId) costAccountId = parent.costAccountId;
    currentId = parent.parentWarehouseId ?? '';
  }
  return { inventoryAccountId, costAccountId };
}
