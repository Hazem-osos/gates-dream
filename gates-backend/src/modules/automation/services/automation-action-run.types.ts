export const AUTOMATION_ACTION_RUN_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type AutomationActionRunStatus = (typeof AUTOMATION_ACTION_RUN_STATUSES)[number];

export const RESULT_ENTITY_PURCHASE_ORDER = 'PurchaseOrder';

export type AutomationActionRunRecord = {
  id: string;
  companyId: string;
  eventId: string;
  ruleId: string;
  actionType: string;
  correlationId: string;
  status: AutomationActionRunStatus;
  resultEntityType: string | null;
  resultEntityId: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseOrderView = {
  id: string;
  orderNumber: string | null;
  companyId: string;
  isPosted: boolean;
  isApproved: boolean;
};

export type AutomationActionRunDb = {
  automationActionRun: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<AutomationActionRunRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<AutomationActionRunRecord | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<AutomationActionRunRecord | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<AutomationActionRunRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMany: (args: any) => Promise<{ count: number }>;
  };
  purchaseOrder: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<PurchaseOrderView | null>;
  };
  company: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<{ id: string; isActive: boolean; deletedAt: Date | null } | null>;
  };
};

export type PurchaseOrderDomain = {
  createPurchaseOrder: (
    companyId: string,
    data: unknown
  ) => Promise<PurchaseOrderView & { isPosted: boolean; isApproved: boolean }>;
  getPurchaseOrderById: (companyId: string, id: string) => Promise<PurchaseOrderView>;
};

export class AutomationPurchaseRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AutomationPurchaseRequestError';
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
  );
}
