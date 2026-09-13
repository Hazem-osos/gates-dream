export type CatalogCustomer = {
  id: string;
  arabicName: string;
  currencyCode: string | null;
  priceTier: string | null;
  phone1: string | null;
  mobile: string | null;
};

export type CatalogItem = {
  id: string;
  arabicName: string;
  isService: boolean;
  isTaxExempt: boolean;
  defaultTaxPercent: number | null;
  priceRetail: number;
  priceSemiWholesale: number;
  priceWholesale: number;
  priceProjects: number;
  retailPrice: number;
  consumerPrice: number;
  unitId: string;
  unitName: string;
  conversionFactor: number;
};

export type CatalogWarehouse = {
  id: string;
  arabicName: string;
};

export type CatalogSupplier = {
  id: string;
  arabicName: string;
  currencyCode: string | null;
};

export type CatalogSafe = {
  id: string;
  arabicName: string;
};

export type WriteCatalogPort = {
  findCustomer(companyId: string, customerId: string): Promise<CatalogCustomer | null>;
  findCustomerByName(companyId: string, name: string): Promise<CatalogCustomer | null>;
  findSupplier(companyId: string, supplierId: string): Promise<CatalogSupplier | null>;
  findSupplierByName(companyId: string, name: string): Promise<CatalogSupplier | null>;
  findItems(companyId: string, itemIds: string[]): Promise<CatalogItem[]>;
  findItemByName(companyId: string, name: string): Promise<CatalogItem | null>;
  findWarehouse(companyId: string, warehouseId: string): Promise<CatalogWarehouse | null>;
  findWarehouseByName(companyId: string, name: string): Promise<CatalogWarehouse | null>;
  findDefaultSafe(companyId: string): Promise<CatalogSafe | null>;
  getWarehouseQty(companyId: string, warehouseId: string, itemId: string): Promise<number>;
  findDuplicateCustomer(
    companyId: string,
    input: { phone?: string; taxNumber?: string }
  ): Promise<{ id: string; arabicName: string; field: 'phone' | 'taxNumber' } | null>;
};
