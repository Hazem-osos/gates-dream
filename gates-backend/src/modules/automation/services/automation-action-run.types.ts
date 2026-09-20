export const AUTOMATION_ACTION_RUN_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type AutomationActionRunStatus = (typeof AUTOMATION_ACTION_RUN_STATUSES)[number];

export const RESULT_ENTITY_PURCHASE_ORDER = 'PurchaseOrder';

export const AUTOMATION_ERROR_CODES = {
  OWNERSHIP: 'OWNERSHIP',
  DOMAIN_ERROR: 'DOMAIN_ERROR',
  DRAFT_POLICY: 'DRAFT_POLICY',
} as const;

export type AutomationResultMetadata = Record<string, string | number | boolean | null>;

export type AutomationActionRunRecord = {
  id: string;
  companyId: string;
  eventId: string;
  ruleId: string;
  actionType: string;
  correlationId: string;
  eventType: string | null;
  attemptCount: number;
  startedAt: Date;
  completedAt: Date | null;
  resultMetadata: unknown;
  lastErrorCode: string | null;
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
  serial?: string | null;
  automationIdempotencyKey?: string | null;
};

export type AutomationActionRunStore = {
  automationActionRun: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<AutomationActionRunRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<AutomationActionRunRecord | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<AutomationActionRunRecord | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<AutomationActionRunRecord[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: (args: any) => Promise<number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<AutomationActionRunRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMany: (args: any) => Promise<{ count: number }>;
  };
};

export type AutomationActionRunDb = AutomationActionRunStore & {
  purchaseOrder: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<PurchaseOrderView | null>;
  };
  company: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<{ id: string; isActive: boolean; deletedAt: Date | null } | null>;
  };
  automationRule?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<{ eventType: string } | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<Array<{ id: string; name: string }>>;
  };
};

export type PurchaseOrderDomain = {
  createPurchaseOrder: (
    companyId: string,
    data: unknown
  ) => Promise<PurchaseOrderView & { isPosted: boolean; isApproved: boolean }>;
  getPurchaseOrderById: (companyId: string, id: string) => Promise<PurchaseOrderView>;
};

export type ClaimKey = {
  companyId: string;
  eventId: string;
  ruleId: string;
  actionType: string;
};

export type ClaimInput = ClaimKey & {
  correlationId: string;
  eventType?: string | null;
};

export type RecoveredActionResult = {
  resultEntityType: string;
  resultEntityId: string;
  resultMetadata?: AutomationResultMetadata | null;
};

export type RecoverActionFn = (run: AutomationActionRunRecord) => Promise<RecoveredActionResult | null>;

export type ClaimResult =
  | { kind: 'claimed'; run: AutomationActionRunRecord }
  | { kind: 'existing'; run: AutomationActionRunRecord }
  | { kind: 'in_progress'; run: AutomationActionRunRecord };

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

const SECRET_METADATA_KEY =
  /^(secret|password|token|api[_-]?key|authorization|private[_-]?key|access[_-]?token|client[_-]?secret)$/i;

/** Drop secret-like keys and nested objects. Primitives only. */
export function sanitizeResultMetadata(
  metadata: Record<string, unknown> | null | undefined
): AutomationResultMetadata | null {
  if (!metadata) return null;
  const out: AutomationResultMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_METADATA_KEY.test(key)) continue;
    if (value !== null && typeof value === 'object') continue;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function toPurchaseOrderResultMetadata(order: {
  orderNumber?: string | null;
}): AutomationResultMetadata {
  return { orderNumber: order.orderNumber ?? null };
}
