import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { companySettingService } from '../../platform/services/company-setting.service';

export interface CreditCheckResult {
  customerId: string;
  balance: number;
  creditLimit: number | null;
  effectiveLimit: number | null;
  additionalAmount: number;
  allowed: boolean;
  creditHold: boolean;
  reason?: string;
}

/** L3 fix (Item 41): supplier-side equivalent of `CreditCheckResult` — same shape, keyed by supplierId. */
export interface SupplierCreditCheckResult {
  supplierId: string;
  balance: number;
  creditLimit: number | null;
  effectiveLimit: number | null;
  additionalAmount: number;
  allowed: boolean;
  creditHold: boolean;
  reason?: string;
}

function toNumber(d: Decimal | null | undefined): number {
  if (d == null) return 0;
  return d.toNumber();
}

export class PartyCreditService {
  /** Legacy: creditLimit, else estimatedBudget as limit. */
  resolveEffectiveLimit(creditLimit: Decimal | null, estimatedBudget: Decimal | null): number | null {
    if (creditLimit != null) return creditLimit.toNumber();
    if (estimatedBudget != null) return estimatedBudget.toNumber();
    return null;
  }

  async checkCustomerCredit(
    companyId: string,
    customerId: string,
    additionalAmount = 0
  ): Promise<CreditCheckResult> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    if (!customer) {
      throw new Error('Customer not found');
    }

    const balance = toNumber(customer.balance);
    const effectiveLimit = this.resolveEffectiveLimit(
      customer.creditLimit,
      customer.estimatedBudget
    );

    let allowed = true;
    let creditHold = false;
    let reason: string | undefined;

    if (effectiveLimit != null && effectiveLimit > 0) {
      const projected = balance + additionalAmount;
      if (projected > effectiveLimit) {
        allowed = false;
        creditHold = true;
        reason = `Projected balance ${projected} exceeds credit limit ${effectiveLimit}`;
      }
    }

    if (customer.warning === 'debtor' && balance + additionalAmount > 0 && effectiveLimit == null) {
      creditHold = true;
    }

    return {
      customerId,
      balance,
      creditLimit: customer.creditLimit?.toNumber() ?? null,
      effectiveLimit,
      additionalAmount,
      allowed,
      creditHold,
      reason,
    };
  }

  assertCustomerCreditAllowed(result: CreditCheckResult): void {
    if (!result.allowed) {
      // Was a plain `Error` — fell through the global error handler's
      // "unknown error" branch as a 500 instead of a client-actionable 422.
      throw new AppError(422, result.reason ?? 'Customer credit limit exceeded');
    }
  }

  /**
   * L3 fix (Item 41): `Supplier.creditLimit`/`estimatedBudget` exist in the
   * schema but nothing ever read them — purchase invoices posted with no
   * limit check at all, unlike sales (see `checkCustomerCredit` above).
   * Mirrors the customer check; `balance` on `Supplier` is a payable (what
   * we owe them), so "exceeding the limit" here means committing to owe
   * this supplier more than the agreed ceiling.
   */
  async checkSupplierCredit(
    companyId: string,
    supplierId: string,
    additionalAmount = 0
  ): Promise<SupplierCreditCheckResult> {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
    });
    if (!supplier) {
      throw new AppError(404, 'Supplier not found');
    }

    const balance = toNumber(supplier.balance);
    const effectiveLimit = this.resolveEffectiveLimit(
      supplier.creditLimit,
      supplier.estimatedBudget
    );

    let allowed = true;
    let creditHold = false;
    let reason: string | undefined;

    if (effectiveLimit != null && effectiveLimit > 0) {
      const projected = balance + additionalAmount;
      if (projected > effectiveLimit) {
        allowed = false;
        creditHold = true;
        reason = `Projected balance ${projected} exceeds supplier credit limit ${effectiveLimit}`;
      }
    }

    return {
      supplierId,
      balance,
      creditLimit: supplier.creditLimit?.toNumber() ?? null,
      effectiveLimit,
      additionalAmount,
      allowed,
      creditHold,
      reason,
    };
  }

  assertSupplierCreditAllowed(result: SupplierCreditCheckResult): void {
    if (!result.allowed) {
      throw new AppError(422, result.reason ?? 'Supplier credit limit exceeded');
    }
  }

  /**
   * Legacy `MoaznaSettings` (`MainProgram/untPInovice.pas` ~19460-19672):
   * besides the per-party limit above (which this web app already covers
   * via `Customer`/`Supplier.creditLimit` + `CreditWarningOnly` — a cleaner
   * but functionally-equivalent stand-in for Moazna modes `'2'`/`'3'`), the
   * *company-wide* AR or AP root account (`CustomersAccount`/
   * `SuppliersAccount`, resolved to `Account.budget` + `Account.warning`
   * direction) can also cap total receivables/payables across every
   * account nested under it in the CoA (legacy `A.FullPath Like
   * '%\ParentAccount\%'`). `'1'` disables Moazna entirely, `'2'`/`'3'` are
   * account-level only (already handled), `'4'` checks the root only,
   * `'5'` checks either. This covers the previously-unwired root-level gap.
   */
  async checkLedgerRootBudget(
    companyId: string,
    branchId: string | null | undefined,
    side: 'CUSTOMER' | 'SUPPLIER',
    additionalAmount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const mode = await companySettingService.getEntryOrLegacyDefault(companyId, 'MoaznaSettings');
    if (mode !== '4' && mode !== '5') return { allowed: true };

    const rootCode = await companySettingService.getEntry(
      companyId,
      side === 'CUSTOMER' ? 'CustomersAccount' : 'SuppliersAccount',
      { branchId: branchId ?? null }
    );
    if (!rootCode?.trim()) return { allowed: true };

    const rootAccount = await prisma.account.findFirst({
      where: { companyId, code: rootCode.trim(), deletedAt: null },
      select: { id: true, budget: true, warning: true },
    });
    if (!rootAccount?.budget || rootAccount.budget.toNumber() <= 0) return { allowed: true };

    const subtreeIds = await this.getSubtreeAccountIds(companyId, rootAccount.id);
    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: { in: subtreeIds },
        journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
      },
      _sum: { debitBase: true, creditBase: true },
    });
    const currentNet = toNumber(agg._sum.debitBase) - toNumber(agg._sum.creditBase);
    const projected = currentNet + additionalAmount;
    const budget = rootAccount.budget.toNumber();

    let overLimit = false;
    if (rootAccount.warning === 'مدين' && projected > 0) {
      overLimit = projected > budget;
    } else if (rootAccount.warning === 'دائن' && projected < 0) {
      overLimit = -projected > budget;
    }

    if (!overLimit) return { allowed: true };
    return {
      allowed: false,
      reason:
        side === 'CUSTOMER'
          ? `إجمالي حسابات العملاء تجاوز الحد الموازن له (${budget})`
          : `إجمالي حسابات الموردين تجاوز الحد الموازن له (${budget})`,
    };
  }

  assertLedgerRootBudgetAllowed(result: { allowed: boolean; reason?: string }): void {
    if (!result.allowed) {
      throw new AppError(422, result.reason ?? 'Ledger root budget exceeded');
    }
  }

  /** Self + every descendant account id under `rootId` per `Account.parentId`. */
  private async getSubtreeAccountIds(companyId: string, rootId: string): Promise<string[]> {
    const accounts = await prisma.account.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const a of accounts) {
      if (!a.parentId) continue;
      const bucket = childrenByParent.get(a.parentId) ?? [];
      bucket.push(a.id);
      childrenByParent.set(a.parentId, bucket);
    }
    const result = [rootId];
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const childId of childrenByParent.get(current) ?? []) {
        result.push(childId);
        stack.push(childId);
      }
    }
    return result;
  }
}

export const partyCreditService = new PartyCreditService();
