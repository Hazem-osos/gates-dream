export type DisassemblyComponentLine = {
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

export function emptyDisassemblyComponentLine(): DisassemblyComponentLine {
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

export function disassemblyLineTotal(line: DisassemblyComponentLine) {
  return (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
}

export function isEnteredDisassemblyLine(line: DisassemblyComponentLine) {
  return Boolean(line.itemId) && Number(line.quantity) > 0;
}
