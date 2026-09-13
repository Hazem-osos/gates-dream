import type { LicenseModuleCode } from '../../platform/types/license-modules';
export type CustomerRevenueRow = {
  customerId: string;
  customerName: string;
  revenue: number;
};

export type StockItemRow = {
  itemId: string;
  itemName: string;
  quantityOnHand: number;
  averageCost: number;
  lastPurchasePrice: number;
  lastSaleAt: Date | null;
};

export type BelowReplacementRow = {
  itemId: string;
  itemName: string;
  salePrice: number;
  replacementCost: number;
};

export type ContractingProjectRow = {
  projectId: string;
  projectName: string;
  contractValue: number;
  estimatedCost: number;
  actualCost: number;
  subcontractorDue: number;
  ownerInflow: number;
};

export type ProductionSnapshot = {
  plannedQuantity: number;
  actualQuantity: number;
  standardMaterialQty: number;
  issuedMaterialQty: number;
};

export type RealEstateSnapshot = {
  totalUnits: number;
  absorbedUnits: number;
  dueInstallments: number;
  overdueInstallments: number;
};

export type PayrollSnapshot = {
  gross: number;
  overtime: number;
  net: number;
};

export type DiagnosticLicensePort = {
  getCurrent(companyId: string): Promise<{
    unrestricted: boolean;
    allowedModules: LicenseModuleCode[];
  }>;
};

export type DiagnosticDataPorts = {
  liquidCash(companyId: string): Promise<{ treasuryTotal: number; bankTotal: number }>;
  periodSales(companyId: string, from: Date, to: Date): Promise<number>;
  periodPurchases(companyId: string, from: Date, to: Date): Promise<number>;
  openReceivables(companyId: string, asOf: Date): Promise<{ total: number; overdue: number; overdue90: number }>;
  openPayables(companyId: string): Promise<number>;
  inventoryValue(companyId: string): Promise<number>;
  customerRevenue(companyId: string, from: Date, to: Date): Promise<CustomerRevenueRow[]>;
  stockItems(companyId: string): Promise<StockItemRow[]>;
  cogs(companyId: string, from: Date, to: Date): Promise<number>;
  belowReplacementSales(companyId: string, from: Date): Promise<BelowReplacementRow[]>;
  contractingProjects(companyId: string, asOf: Date, horizonDays: number): Promise<ContractingProjectRow[]>;
  production(companyId: string, from: Date): Promise<ProductionSnapshot>;
  realEstate(companyId: string, asOf: Date): Promise<RealEstateSnapshot>;
  latestPayroll(companyId: string): Promise<PayrollSnapshot | null>;
};

export type DiagnosticPorts = DiagnosticLicensePort & DiagnosticDataPorts;
