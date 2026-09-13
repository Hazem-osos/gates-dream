/**
 * Isolated test fixtures for Module A / B. Every suite uses a dedicated
 * companyId so tenant-scoped queries cannot leak across cases.
 */
import { money } from '../../src/modules/subcontracts/utils/money-decimal';

export const TEST_COMPANY_ID = '00000000-0000-4000-8000-mod0000000a1';
export const TEST_USER_ID = '00000000-0000-4000-8000-mod0000000u1';

export function ids(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function decimalish(value: string | number) {
  return money(value);
}

export const SUBCONTRACT_GL_ACCOUNTS = {
  wipAccountId: 'acc-wip',
  advanceAccountId: 'acc-advance',
  retentionAccountId: 'acc-retention',
  whtAccountId: 'acc-wht',
  socialAccountId: 'acc-social',
  materialAccountId: 'acc-material',
  penaltyAccountId: 'acc-penalty',
  directExecAccountId: 'acc-direct',
  earlyPayAccountId: 'acc-early',
  apAccountId: 'acc-ap',
};

export function makeBoqItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'boq-1',
    itemCode: '1.1',
    contractQuantity: money(100),
    maxAllowedQuantity: money(110),
    unitPrice: money(1000),
    ...overrides,
  };
}

export function makeSubcontract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sc-1',
    companyId: TEST_COMPANY_ID,
    subcontractNumber: 'SC-TEST-001',
    status: 'ACTIVE',
    advancePaymentTotal: money(100_000),
    advancePaymentRecoveryRate: money('0.10'),
    retentionRate: money('0.05'),
    taxWithholdingRate: money('0.01'),
    socialInsuranceRate: money('0.01'),
    earlyPaymentDiscountRate: money('0.02'),
    standardScrapToleranceRate: money('0.05'),
    contractAdminOverheadRate: money('0.10'),
    boqItems: [makeBoqItem()],
    ...overrides,
  };
}

export function makePriorInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-hist-1',
    companyId: TEST_COMPANY_ID,
    status: 'FINANCE_POSTED',
    sequenceNumber: 1,
    grossCurrentAmount: money(50_000),
    advancePaymentDeduction: money(5_000),
    items: [
      {
        subcontractBOQItemId: 'boq-1',
        currentQuantity: money(50),
      },
    ],
    ...overrides,
  };
}

export function makeCalcDb(opts: {
  subcontract?: Record<string, unknown> | null;
  priorInvoices?: unknown[];
  penalties?: Array<{ id: string; amount: ReturnType<typeof money> }>;
  materials?: Array<{ id: string; totalPenaltyAmount: ReturnType<typeof money> }>;
  direct?: Array<{ id: string; totalDeduction: ReturnType<typeof money> }>;
} = {}) {
  return {
    subcontract: {
      findFirst: jest.fn().mockResolvedValue(opts.subcontract === undefined ? makeSubcontract() : opts.subcontract),
    },
    subcontractInvoice: {
      findMany: jest.fn().mockResolvedValue(opts.priorInvoices ?? []),
    },
    sitePenaltyAndSnag: {
      findMany: jest.fn().mockResolvedValue(opts.penalties ?? []),
    },
    materialReconciliationLog: {
      findMany: jest.fn().mockResolvedValue(opts.materials ?? []),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'mat-log-1', warehouseIssueSlipNumber: data.warehouseIssueSlipNumber ?? null, ...data })
      ),
    },
    directExecutionCharge: {
      findMany: jest.fn().mockResolvedValue(opts.direct ?? []),
    },
    item: {
      findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
    },
  };
}

export function makePostedInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-gl-1',
    companyId: TEST_COMPANY_ID,
    invoiceNumber: 'SC-TEST-001-007',
    periodEndDate: new Date('2026-03-31T00:00:00Z'),
    journalEntryId: null,
    grossCurrentAmount: money(100_000),
    advancePaymentDeduction: money(10_000),
    retentionDeduction: money(5_000),
    taxWithholdingDeduction: money(1_000),
    socialInsuranceDeduction: money(1_000),
    materialOveruseDeduction: money(2_000),
    sitePenaltiesDeduction: money(1_500),
    directExecutionDeduction: money(3_000),
    earlyPaymentDiscountDeduction: money(0),
    netPayableAmount: money(76_500),
    ...overrides,
  };
}

export function makeInstallment(overrides: Record<string, unknown> = {}) {
  const amount = money(overrides.amount ?? 10_000);
  return {
    id: 'inst-1',
    contractId: 'uc-1',
    installmentNumber: 1,
    installmentType: 'REGULAR_INSTALLMENT',
    dueDate: new Date('2026-01-01T00:00:00Z'),
    amount,
    originalAmount: overrides.originalAmount ?? amount,
    paidAmount: money(overrides.paidAmount ?? 0),
    balance: overrides.balance ?? amount,
    dailyLateFeeRate: money(overrides.dailyLateFeeRate ?? '0.0005'),
    accumulatedLateFee: money(overrides.accumulatedLateFee ?? 0),
    interestPortion: money(0),
    status: overrides.status ?? 'UNPAID',
    paymentTransactionId: null,
    paidAt: null,
    ...overrides,
    amount,
  };
}
