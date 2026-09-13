export type AssemblyComponentLine = {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitId: string;
  unitName: string;
  availableQuantity: number;
  quantity: number;
  unitCost: number;
  notes: string;
};

export function emptyAssemblyComponentLine(): AssemblyComponentLine {
  return {
    itemId: '',
    itemCode: '',
    itemName: '',
    unitId: '',
    unitName: '',
    availableQuantity: 0,
    quantity: 0,
    unitCost: 0,
    notes: '',
  };
}

export function assemblyLineTotal(line: AssemblyComponentLine) {
  return (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
}

export function isEnteredAssemblyLine(line: AssemblyComponentLine) {
  return Boolean(line.itemId) && Number(line.quantity) > 0;
}
