export type WarehouseKindValue = 'HEADER' | 'POSTING';

export function resolveCreateWarehouseKind(input: {
  parentWarehouseId?: string | null;
  warehouseKind?: WarehouseKindValue | null;
}): WarehouseKindValue {
  if (!input.parentWarehouseId) {
    return input.warehouseKind === 'POSTING' ? 'POSTING' : 'HEADER';
  }
  return input.warehouseKind === 'HEADER' ? 'HEADER' : 'POSTING';
}

export function isHeaderWarehouseKind(kind: string | null | undefined): boolean {
  return kind === 'HEADER';
}

export function isOperationsWarehouseKind(kind: string | null | undefined): boolean {
  return kind !== 'HEADER';
}
