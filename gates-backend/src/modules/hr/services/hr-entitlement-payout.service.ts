import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';

/**
 * Cash payout of an HR entitlement that was already accrued by its clearance
 * (تصفية): Dr accrued payroll / Cr safe or bank. Same accounts as the payroll
 * run disbursement, so the accrued-payroll liability is cleared and the safe
 * or bank balance moves through the normal GL posting path.
 */
export type HrPayoutKind = 'EOS' | 'HOUSING' | 'LEAVE';

const SOURCE_TYPE: Record<HrPayoutKind, string> = {
  EOS: 'HR-EOS-PAY',
  HOUSING: 'HR-HSG-PAY',
  LEAVE: 'HR-LV-PAY',
};

const PAYOUT_ENTRY_TYPE = 'HrPayout';

const LABEL: Record<HrPayoutKind, string> = {
  EOS: 'صرف مستحقات نهاية الخدمة',
  HOUSING: 'صرف بدل السكن',
  LEAVE: 'صرف مستحقات الإجازة السنوية',
};

export interface HrPayoutSource {
  safeId?: string | null;
  bankAccountId?: string | null;
}

export interface PreparedHrPayout {
  fiscalYearId: string;
  accruedPayrollAccountId: string;
  cashGlAccountId: string;
  currencyCode: string;
}

export class HrEntitlementPayoutService {
  /** Resolve accounts and the open fiscal year before the write transaction. */
  async prepare(companyId: string, date: Date, source: HrPayoutSource): Promise<PreparedHrPayout> {
    if (!source.safeId && !source.bankAccountId) {
      throw new AppError(422, 'اختر الخزينة أو الحساب البنكي الذي سيتم الصرف منه');
    }
    if (source.safeId && source.bankAccountId) {
      throw new AppError(422, 'اختر خزينة أو حساباً بنكياً واحداً فقط');
    }
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, date);
    const accounts = await hrGlAccountResolverService.resolveAccounts(companyId);
    if (!accounts.accruedPayrollAccountId) {
      throw new AppError(422, 'حساب مستحقات الرواتب غير معرّف في إعدادات الموارد البشرية');
    }
    const cashGlAccountId = source.safeId
      ? await treasuryAccountResolverService.resolveSafeGlAccountId(companyId, source.safeId)
      : await treasuryAccountResolverService.resolveBankGlAccountId(companyId, source.bankAccountId!);
    const company = await prisma.companySettings.findUnique({ where: { companyId }, select: { defaultCurrency: true } });
    return {
      fiscalYearId,
      accruedPayrollAccountId: accounts.accruedPayrollAccountId,
      cashGlAccountId,
      currencyCode: company?.defaultCurrency?.trim() || 'EGP',
    };
  }

  async postInTx(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      userId: string;
      kind: HrPayoutKind;
      disbursementId: string;
      employeeName: string;
      amount: number;
      date: Date;
      prepared: PreparedHrPayout;
    }
  ) {
    const { prepared, kind } = params;
    const amount = Math.round(Number(params.amount) * 100) / 100;
    if (!(amount > 0)) throw new AppError(422, 'قيمة الصرف يجب أن تكون أكبر من صفر');
    const description = `${LABEL[kind]} - ${params.employeeName}`;
    return journalPostingService.createAndPostInTx(
      tx,
      { companyId: params.companyId, userId: params.userId, fiscalYearId: prepared.fiscalYearId },
      {
        fiscalYearId: prepared.fiscalYearId,
        date: params.date,
        description,
        currencyCode: prepared.currencyCode,
        exchangeRate: 1,
        entryType: PAYOUT_ENTRY_TYPE,
        sourceType: SOURCE_TYPE[kind],
        sourceId: params.disbursementId,
        // Column limits: sourceNumber VarChar(30), sourceYearId VarChar(20).
        // The full id stays in sourceId (used by reverseInTx).
        sourceNumber: `P${params.disbursementId.replace(/-/g, '')}`.slice(0, 30),
        sourceYearId: String(params.date.getUTCFullYear()),
        lines: journalLines([
          { accountId: prepared.accruedPayrollAccountId, debit: amount, credit: 0, description },
          { accountId: prepared.cashGlAccountId, debit: 0, credit: amount, description },
        ]),
      }
    );
  }

  /**
   * Reverse the payout journal of a disbursement (dated contra entry).
   * Returns false when the disbursement never posted a payout (old records).
   */
  async reverseInTx(
    tx: Prisma.TransactionClient,
    params: { companyId: string; userId: string; kind: HrPayoutKind; disbursementId: string }
  ): Promise<boolean> {
    const je = await tx.journalEntry.findFirst({
      // journalPostingService drops source types it does not know (HR has no
      // JournalSourceType), so match on the stored sourceId + entryType.
      where: {
        companyId: params.companyId,
        entryType: PAYOUT_ENTRY_TYPE,
        sourceId: params.disbursementId,
        reversalOfJournalEntryId: null,
        deletedAt: null,
        isCancelled: false,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fiscalYearId: true },
    });
    if (!je) return false;
    await journalPostingService.reverseJournalEntryInTx(
      tx,
      { companyId: params.companyId, userId: params.userId, fiscalYearId: je.fiscalYearId ?? undefined },
      je.id,
      { reason: `إلغاء ${LABEL[params.kind]}` }
    );
    return true;
  }
}

export const hrEntitlementPayoutService = new HrEntitlementPayoutService();
