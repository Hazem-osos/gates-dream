export type UnitContractStatus =
  | 'ACTIVE'
  | 'RESALE_IN_PROGRESS'
  | 'TRANSFERRED'
  | 'TERMINATED'
  | 'TERMINATED_FORFEITED'
  | 'COMPLETED';

export type InstallmentType =
  | 'RESERVATION_DEPOSIT'
  | 'CONTRACTING_DOWNPAYMENT'
  | 'REGULAR_INSTALLMENT'
  | 'DELIVERY_PAYMENT'
  | 'MAINTENANCE_DEPOSIT'
  | 'ANNUAL_BALLOON';

export type InstallmentStatus =
  | 'PENDING'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type PdcStatus =
  | 'UNDER_SAFE_CUSTODY'
  | 'DEPOSITED_UNDER_COLLECTION'
  | 'CLEARED_COLLECTED'
  | 'BOUNCED_RETURNED'
  | 'REPLACED_CANCELLED';

export type PaymentAllocation = 'LATE_FEES_FIRST' | 'PRINCIPAL_FIRST';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'LINKED_PDC';
export type InstallmentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export type CustomerRef = { id: string; arabicName?: string | null; code?: string | null };

export type UnitInstallment = {
  id: string;
  installmentType: InstallmentType;
  installmentNumber: number;
  dueDate: string;
  amount: string | number;
  originalAmount: string | number;
  paidAmount: string | number;
  balance: string | number;
  accumulatedLateFee: string | number;
  status: InstallmentStatus;
  chequeId?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
};

export type PostDatedCheque = {
  id: string;
  chequeNumber: string;
  bankName: string;
  drawerName: string;
  chequeDate: string;
  amount: string | number;
  status: PdcStatus;
  bouncedReason?: string | null;
  journalEntryId?: string | null;
  unitContractId: string;
  unitInstallmentId?: string | null;
  contract?: {
    id: string;
    contractNumber: string;
    customer?: CustomerRef;
    unit?: { id: string; unitCode: string };
  };
};

export type UnitResaleTransfer = {
  id: string;
  unitContractId: string;
  currentUnitMarketValue: string | number;
  assignmentFeeRate: string | number;
  assignmentFeeAmount: string | number;
  isAssignmentFeePaid: boolean;
  clearanceStatus: 'PENDING_CLEARANCE' | 'FINANCIALLY_CLEARED' | 'REJECTED';
  seller?: CustomerRef;
  newBuyer?: CustomerRef;
  contract?: {
    id: string;
    contractNumber: string;
    status: string;
    resaleLock: boolean;
    unit?: { unitCode: string };
    installments?: Array<{ id: string; status: string; balance: string | number; dueDate: string }>;
  };
};

export type UnitContract = {
  id: string;
  contractNumber: string;
  contractDate: string;
  deliveryDate?: string | null;
  totalContractAmount: string | number;
  totalSellingPrice: string | number;
  maintenanceAmount: string | number;
  maintenanceDeposit: string | number;
  downPayment: string | number;
  status: UnitContractStatus;
  resaleLock: boolean;
  customer: CustomerRef & { phone?: string | null };
  unit?: {
    id: string;
    unitCode: string;
    status?: string;
    building?: { name?: string; buildingCode?: string; project?: { projectCode: string; projectName: string } };
  };
  propertyUnit?: {
    unitCode: string;
    phase?: { nameAr?: string; phaseCode?: string; project?: { nameAr?: string; projectCode?: string } };
  };
  installments: UnitInstallment[];
  postDatedCheques?: PostDatedCheque[];
  resaleTransfers?: UnitResaleTransfer[];
};

export type UnitContractListItem = {
  id: string;
  contractNumber: string;
  contractDate: string;
  totalSellingPrice?: string | number;
  totalContractAmount: string | number;
  status: UnitContractStatus;
  resaleLock?: boolean;
  customer?: CustomerRef;
  unit?: { id: string; unitCode: string; status?: string };
  _count?: { installments: number };
};

export type ChequePortfolio = {
  cheques: PostDatedCheque[];
  stats: {
    inCustodyCount: number;
    inCustodyValue: number;
    underCollectionCount: number;
    underCollectionValue: number;
    clearedCount: number;
    clearedValue: number;
    bouncedCount: number;
    bouncedValue: number;
    dueIn7DaysCount: number;
  };
};

export type RentalPoolAgreement = {
  id: string;
  managementFeeRate: string | number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  propertyUnit?: { id: string; unitCode: string; status?: string };
  owner?: CustomerRef;
  contract?: { id: string; contractNumber: string; status: string };
  distributions?: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    netDistributedAmount: string | number;
    developerManagementFee: string | number;
  }>;
};

export type BankAccountOption = {
  id: string;
  accountNumber?: string;
  arabicName?: string;
  name?: string;
  bankName?: string;
};
