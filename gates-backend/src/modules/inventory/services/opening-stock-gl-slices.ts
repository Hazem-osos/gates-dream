export type OpeningInventoryGlSlice = {
  accountId: string;
  value: number;
  description: string;
  warehouseId?: string;
};

export type OpeningInventoryValuationGroup = {
  warehouseId: string;
  warehouseName: string;
  accountId: string;
  valuation: number;
};
