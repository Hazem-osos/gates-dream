export type SecurityContext = {
  userId: string;
  companyId: string;
  conversationId?: string;
  branchId?: string;
  permissions: string[];
  /** JWT / Keycloak roles used for dynamic AI tool masking. */
  roles?: string[];
  role?: string;
  permittedBranchIds?: string[];
  fiscalYearId?: string;
  /** Optional B2B customer binding — tools must ignore any other customerId. */
  boundCustomerId?: string;
  channel?: 'web';
};

export type AiToolSuccess<T = unknown> = {
  ok: true;
  tool: string;
  data: T;
  asOf: string;
};

export type AiToolFailure = {
  ok: false;
  tool: string;
  error: 'PERMISSION_DENIED' | 'VALIDATION_ERROR' | 'INVALID_CONTEXT' | 'EXECUTION_ERROR';
  message: string;
};

export type AiToolResult<T = unknown> = AiToolSuccess<T> | AiToolFailure;

export const TENANT_ARG_KEYS = [
  'companyId',
  'tenantId',
  'company_id',
  'tenant_id',
  'companyID',
  'tenantID',
  'userId',
  'user_id',
  'userID',
] as const;
