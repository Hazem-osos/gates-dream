import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { FINANCIAL_DIRECTOR_ROLES } from './ai-tool-access';
import { BaseAiTool } from './base-ai-tool';
import type { CashBalancesBankPort, CashBalancesTreasuryPort } from './get-cash-and-bank-balances.tool';
import { periodRange } from './period-range';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  period: z.enum(['today', 'this_month', 'this_year']).optional(),
  includeBanks: z.boolean().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export class FinancialOverviewTool extends BaseAiTool<Params> {
  readonly name = 'financial_overview_tool';
  readonly description =
    'Consolidated posted cash/treasury and bank balances plus posted inflow vs outflow for a period. Never includes drafts.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';
  readonly allowedRoles = FINANCIAL_DIRECTOR_ROLES;

  constructor(
    private readonly safes: CashBalancesTreasuryPort,
    private readonly banks: CashBalancesBankPort
  ) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const period = params.period ?? 'this_month';
    const includeBanks = params.includeBanks !== false;
    const { start, end, label } = periodRange(period);
    const [safeRows, bankRows, cashAgg] = await Promise.all([
      this.safes.getSafes(context.companyId, { isActive: true }),
      includeBanks
        ? this.banks.getBankAccounts(context.companyId, { isActive: true })
        : Promise.resolve([]),
      prisma.cashTransaction.groupBy({
        by: ['transactionKind'],
        where: {
          companyId: context.companyId,
          isPosted: true,
          isCancelled: false,
          documentRole: 'VOUCHER',
          date: { gte: start, lte: end },
          ...(context.branchId ? { branchId: context.branchId } : {}),
        },
        _sum: { amount: true },
      }),
    ]);

    const treasuries = safeRows.map((row) => ({
      id: row.id,
      name: row.arabicName,
      balance: Number(row.balance ?? 0),
    }));
    const bankAccounts = bankRows.map((row) => ({
      id: row.id,
      name: row.arabicName,
      bankName: row.bank?.arabicName ?? null,
      balance: Number(row.balance ?? 0),
    }));

    const inflow = cashAgg
      .filter((row) => row.transactionKind === 'RECEIPT')
      .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
    const outflow = cashAgg
      .filter((row) => row.transactionKind === 'PAYMENT')
      .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);

    const treasuryTotal = treasuries.reduce((sum, row) => sum + row.balance, 0);
    const bankTotal = bankAccounts.reduce((sum, row) => sum + row.balance, 0);

    return {
      period,
      periodLabel: label,
      treasuries,
      bankAccounts: includeBanks ? bankAccounts : [],
      treasuryTotal,
      bankTotal,
      cashAndBankTotal: treasuryTotal + bankTotal,
      postedInflow: inflow,
      postedOutflow: outflow,
      netCashFlow: inflow - outflow,
      note: 'Posted vouchers only — drafts and unapproved documents are excluded.',
    };
  }
}
