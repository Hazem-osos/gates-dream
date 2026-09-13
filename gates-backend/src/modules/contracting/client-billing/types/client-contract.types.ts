import type { DecimalInput } from '../../utils/money-decimal';

export interface CreateClientContractDto {
  projectId: string;
  contractNumber: string;
  clientCustomerId: string;
  contractDate: Date;
  totalContractValue: DecimalInput;
  advancePaymentAmount?: DecimalInput;
  advanceRecoveryRate?: DecimalInput;
  retentionRate?: DecimalInput;
  engineeringStampsRate?: DecimalInput;
}

export interface CreateSiteStockDto {
  projectId: string;
  materialDescription: string;
  deliveryDate: Date;
  warehouseReceiptRef?: string | null;
  deliveredQuantity: DecimalInput;
  unitPrice: DecimalInput;
  approvedPercentage?: DecimalInput;
}
