import { z } from 'zod';
import { FINANCIAL_DIRECTOR_ROLES } from './ai-tool-access';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const paramsSchema = z.object({});

export type CashBalancesTreasuryPort = {
  getSafes: (
    companyId: string,
    options?: { isActive?: boolean }
  ) => Promise<Array<{ id: string; arabicName: string; code?: string | null; balance?: unknown }>>;
};
export type CashBalancesBankPort = {
  getBankAccounts: (
    companyId: string,
    options?: { isActive?: boolean }
  ) => Promise<
    Array<{
      id: string;
      arabicName: string;
      balance?: unknown;
      bank?: { arabicName?: string | null };
    }>
  >;
};

export class GetCashAndBankBalancesTool extends BaseAiTool<Record<string, never>> {
  readonly name = 'getCashAndBankBalances';
  readonly description = 'Current treasury (safe) and bank-account balances. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';
  readonly allowedRoles = FINANCIAL_DIRECTOR_ROLES;

  constructor(
    private readonly safes: CashBalancesTreasuryPort,
    private readonly banks: CashBalancesBankPort
  ) {
    super();
  }

  protected async run(_params: Record<string, never>, context: SecurityContext) {
    const [safeRows, bankRows] = await Promise.all([
      this.safes.getSafes(context.companyId, { isActive: true }),
      this.banks.getBankAccounts(context.companyId, { isActive: true }),
    ]);

    const treasuries = safeRows.map((row) => ({
      id: row.id,
      name: row.arabicName,
      code: row.code ?? null,
      balance: Number(row.balance ?? 0),
    }));
    const bankAccounts = bankRows.map((row) => ({
      id: row.id,
      name: row.arabicName,
      bankName: row.bank?.arabicName ?? null,
      balance: Number(row.balance ?? 0),
    }));

    const treasuryTotal = treasuries.reduce((sum, row) => sum + row.balance, 0);
    const bankTotal = bankAccounts.reduce((sum, row) => sum + row.balance, 0);

    return {
      treasuries,
      bankAccounts,
      treasuryTotal,
      bankTotal,
      cashAndBankTotal: treasuryTotal + bankTotal,
    };
  }
}
