export type InvoiceVolumeRow = {
  id: string;
  invoiceNumber: string | null;
  createdBy: string | null;
  date: Date;
  createdAt: Date;
  isCancelled: boolean;
  netAmount: number;
};

export type UserNameRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
};

export type ShortageRow = {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  shortageQty: number;
};

export type SaleLineRow = {
  invoiceId: string;
  invoiceNumber: string | null;
  itemId: string;
  itemName: string;
  salePrice: number;
  averageCost: number;
  lastPurchasePrice: number;
};

export type PurchasePriceRow = {
  itemId: string;
  unitPrice: number;
  date: Date;
};

export type SubInvoiceRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  netPayable: number;
  periodEndDate: Date;
};

export type OwnerExtractRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  netAmount: number;
};

export type SentinelPorts = {
  listInvoices(companyId: string, from: Date, to: Date): Promise<InvoiceVolumeRow[]>;
  listUsers(companyId: string, ids: string[]): Promise<UserNameRow[]>;
  listShortageWriteoffs(companyId: string, from: Date): Promise<ShortageRow[]>;
  listRecentSaleLines(companyId: string, from: Date): Promise<SaleLineRow[]>;
  listLatestPurchasePrices(companyId: string, itemIds: string[]): Promise<PurchasePriceRow[]>;
  listPendingSubcontractorCertificates(companyId: string, to: Date): Promise<SubInvoiceRow[]>;
  listApprovedOwnerCertificates(companyId: string, from: Date, to: Date): Promise<OwnerExtractRow[]>;
  liquidCash(companyId: string): Promise<{ treasuryTotal: number; bankTotal: number }>;
};
