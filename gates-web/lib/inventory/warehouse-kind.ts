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
