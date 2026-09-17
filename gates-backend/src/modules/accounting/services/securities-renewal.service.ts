import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { SYSTEM_GL_CODES } from '../data/system-account-map';
import { documentSequenceService } from '../../platform/services/document-sequence.service';

/** Minimal context needed to post a real GL entry for a securities renewal fee. */
export interface SecuritiesRenewalPostingCtx {
  branchId?: string | null;
  userId: string;
}

export interface CreateSecuritiesRenewalData {
  branchId?: string;
  serial?: string;
  renewalNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  originalSecurityId?: string;
  originalSecurityType?: 'receipt' | 'payment';
  newDueDate?: Date;
  newAmount?: number;
  renewalFee?: number;
}

export interface UpdateSecuritiesRenewalData {
  branchId?: string;
  serial?: string;
  renewalNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  originalSecurityId?: string;
  originalSecurityType?: 'receipt' | 'payment';
  newDueDate?: Date;
  newAmount?: number;
  renewalFee?: number;
}

export class SecuritiesRenewalService {
  /**
   * Get all securities renewals for a company
   */
  async getSecuritiesRenewals(
    companyId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      isPosted?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = options.startDate;
      if (options.endDate) where.date.lte = options.endDate;
    }

    if (options?.isPosted !== undefined) {
      where.isPosted = options.isPosted;
    }

    const [renewals, total] = await Promise.all([
      prisma.securitiesRenewal.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.securitiesRenewal.count({ where }),
    ]);

    return {
      renewals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single securities renewal by ID
   */
  async getSecuritiesRenewalById(companyId: string, renewalId: string) {
    const renewal = await prisma.securitiesRenewal.findFirst({
      where: {
        id: renewalId,
        companyId,
      },
    });

    if (!renewal) {
      throw new Error('Securities renewal not found');
    }

    return renewal;
  }

  /**
   * Create a new securities renewal
   */
  async createSecuritiesRenewal(companyId: string, data: CreateSecuritiesRenewalData) {
    // Validate original security if provided
    if (data.originalSecurityId && data.originalSecurityType) {
      if (data.originalSecurityType === 'receipt') {
        const receipt = await prisma.securitiesReceipt.findFirst({
          where: {
            id: data.originalSecurityId,
            companyId,
          },
        });

        if (!receipt) {
          throw new Error('Original securities receipt not found');
        }
      } else if (data.originalSecurityType === 'payment') {
        const payment = await prisma.securitiesPayment.findFirst({
          where: {
            id: data.originalSecurityId,
            companyId,
          },
        });

        if (!payment) {
          throw new Error('Original securities payment not found');
        }
      }
    }

    // Check renewal number uniqueness
    if (data.renewalNumber) {
      const existing = await prisma.securitiesRenewal.findFirst({
        where: {
          companyId,
          renewalNumber: data.renewalNumber,
        },
      });

      if (existing) {
        throw new Error('Renewal number already exists');
      }
    }

    const renewalNumber =
      data.renewalNumber?.trim() ||
      (await documentSequenceService.nextNumberForFamily({
        companyId,
        branchId: data.branchId ?? null,
        fiscalYearId: null,
        docType: 'SECURITIES-RENEWAL',
        legacySuffix: 'RN01',
        seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
          const rows = await prisma.securitiesRenewal.findMany({
            where: { companyId },
            select: { renewalNumber: true },
          });
          return rows.map((r) => r.renewalNumber);
        }),
        isAvailable: async (candidate) => {
          const taken = await prisma.securitiesRenewal.findFirst({
            where: { companyId, renewalNumber: candidate },
            select: { id: true },
          });
          return !taken;
        },
      })) ||
      null;

    return prisma.securitiesRenewal.create({
      data: {
        companyId,
        branchId: data.branchId,
        serial: data.serial,
        renewalNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        originalSecurityId: data.originalSecurityId,
        originalSecurityType: data.originalSecurityType,
        newDueDate: data.newDueDate,
        newAmount: data.newAmount ? new Decimal(data.newAmount) : null,
        renewalFee: data.renewalFee ? new Decimal(data.renewalFee) : null,
        isPosted: false,
        isApproved: false,
        isCancelled: false,
      },
    });
  }

  /**
   * Update a securities renewal
   */
  async updateSecuritiesRenewal(
    companyId: string,
    renewalId: string,
    data: UpdateSecuritiesRenewalData
  ) {
    const renewal = await this.getSecuritiesRenewalById(companyId, renewalId);

    if (renewal.isPosted) {
      throw new Error('Cannot update a posted securities renewal');
    }

    if (renewal.isCancelled) {
      throw new Error('Cannot update a cancelled securities renewal');
    }

    // Check renewal number uniqueness if changing
    if (data.renewalNumber && data.renewalNumber !== renewal.renewalNumber) {
      const existing = await prisma.securitiesRenewal.findFirst({
        where: {
          companyId,
          renewalNumber: data.renewalNumber,
          id: { not: renewalId },
        },
      });

      if (existing) {
        throw new Error('Renewal number already exists');
      }
    }

    const updateData: any = {};
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.serial !== undefined) updateData.serial = data.serial;
    if (data.renewalNumber !== undefined) updateData.renewalNumber = data.renewalNumber;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.originalSecurityId !== undefined)
      updateData.originalSecurityId = data.originalSecurityId;
    if (data.originalSecurityType !== undefined)
      updateData.originalSecurityType = data.originalSecurityType;
    if (data.newDueDate !== undefined) updateData.newDueDate = data.newDueDate;
    if (data.newAmount !== undefined)
      updateData.newAmount = data.newAmount ? new Decimal(data.newAmount) : null;
    if (data.renewalFee !== undefined)
      updateData.renewalFee = data.renewalFee ? new Decimal(data.renewalFee) : null;

    return prisma.securitiesRenewal.update({
      where: { id: renewalId },
      data: updateData,
    });
  }

  /** Resolves the party + currency of the original security being renewed. */
  private async resolveOriginalSecurityParty(
    companyId: string,
    originalSecurityId: string,
    originalSecurityType: string
  ): Promise<{ customerId: string | null; supplierId: string | null; currencyCode: string }> {
    if (originalSecurityType === 'receipt') {
      const orig = await prisma.securitiesReceipt.findFirst({
        where: { id: originalSecurityId, companyId },
      });
      if (!orig) {
        throw new AppError(404, 'Original securities receipt not found');
      }
      return {
        customerId: orig.customerId ?? null,
        supplierId: orig.supplierId ?? null,
        currencyCode: orig.currencyCode,
      };
    }
    const orig = await prisma.securitiesPayment.findFirst({
      where: { id: originalSecurityId, companyId },
    });
    if (!orig) {
      throw new AppError(404, 'Original securities payment not found');
    }
    return {
      customerId: orig.customerId ?? null,
      supplierId: orig.supplierId ?? null,
      currencyCode: orig.currencyCode,
    };
  }

  /**
   * Resolves the GL account for the renewal-fee side of the entry. The expense
   * side reuses the standard bank-fees account (provisioned for every tenant)
   * unless the company has configured a dedicated code; the income side has no
   * standard account, so it must be explicitly configured.
   */
  private async resolveRenewalFeeAccount(
    companyId: string,
    direction: 'income' | 'expense'
  ): Promise<string> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { accountDefinitions: true },
    });
    const defs = (settings?.accountDefinitions ?? {}) as Record<string, string | undefined>;

    if (direction === 'expense') {
      const code =
        defs.securitiesRenewalFeeExpenseAccount ||
        defs.bankFeesAccount ||
        SYSTEM_GL_CODES.bankFees;
      return invoiceAccountResolverService.resolveAccountId(companyId, code);
    }

    const code = defs.securitiesRenewalFeeIncomeAccount;
    if (!code) {
      throw new AppError(
        422,
        'Securities renewal fee income account is not configured. Set "securitiesRenewalFeeIncomeAccount" in company settings before posting a renewal that charges a fee to the party.'
      );
    }
    return invoiceAccountResolverService.resolveAccountId(companyId, code);
  }

  /**
   * Post a securities renewal.
   *
   * A renewal that only extends the due date/amount of the underlying
   * instrument has no accounting effect of its own — the party's AR/AP
   * balance was already settled when the original security was received or
   * issued — so it is safe to flip the workflow-lock flag with no journal
   * entry. A non-zero `renewalFee`, however, is a real economic event (the
   * party is charged for the extension), so it must post a real, reversible
   * 2-line journal instead of a phantom `isPosted` flag (Wave 2 fix).
   */
  async postSecuritiesRenewal(
    companyId: string,
    renewalId: string,
    ctx: SecuritiesRenewalPostingCtx
  ) {
    const renewal = await this.getSecuritiesRenewalById(companyId, renewalId);

    if (renewal.isCancelled) {
      throw new Error('Cannot post a cancelled securities renewal');
    }

    if (renewal.isPosted) {
      throw new Error('Securities renewal is already posted');
    }

    const fee = renewal.renewalFee ? Number(renewal.renewalFee) : 0;

    if (fee <= 0) {
      return prisma.securitiesRenewal.update({
        where: { id: renewalId },
        data: { isPosted: true, postedAt: new Date() },
      });
    }

    if (!renewal.originalSecurityId || !renewal.originalSecurityType) {
      throw new AppError(
        422,
        'A renewal fee requires the original security reference to determine which party bears it'
      );
    }

    const { customerId, supplierId, currencyCode } = await this.resolveOriginalSecurityParty(
      companyId,
      renewal.originalSecurityId,
      renewal.originalSecurityType
    );
    if (!customerId && !supplierId) {
      throw new AppError(422, 'Original security has no customer or supplier to charge the renewal fee to');
    }

    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, renewal.date);
    const partyAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId,
      customerId,
      supplierId,
    });

    const posted = await prisma.$transaction(async (tx) => {
      const isReceiptRenewal = renewal.originalSecurityType === 'receipt';
      const feeAccountId = await this.resolveRenewalFeeAccount(
        companyId,
        isReceiptRenewal ? 'income' : 'expense'
      );

      // Receipt renewal: the party (who gave us the note) is charged the fee,
      // increasing what they owe us — income to the company.
      // Payment renewal: we bear the fee, increasing what we owe the party —
      // expense to the company.
      const lines = isReceiptRenewal
        ? [
            { accountId: partyAccountId, debit: fee, credit: 0, lineOrder: 1 },
            { accountId: feeAccountId, debit: 0, credit: fee, lineOrder: 2 },
          ]
        : [
            { accountId: feeAccountId, debit: fee, credit: 0, lineOrder: 1 },
            { accountId: partyAccountId, debit: 0, credit: fee, lineOrder: 2 },
          ];

      const je = await journalPostingService.createAndPostInTx(
        tx,
        { companyId, branchId: ctx.branchId?.trim() || undefined, fiscalYearId, userId: ctx.userId },
        {
          fiscalYearId,
          date: renewal.date,
          description:
            renewal.description ??
            `Securities renewal fee ${renewal.renewalNumber ?? renewal.id.slice(0, 8)}`,
          currencyCode,
          entryType: 'SecuritiesRenewal',
          sourceType: 'SECREN',
          sourceNumber: renewal.renewalNumber ?? renewal.id,
          lines,
        }
      );

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: new Decimal(fee) } },
        });
      }
      if (supplierId) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balance: { increment: new Decimal(fee) } },
        });
      }

      return tx.securitiesRenewal.update({
        where: { id: renewalId },
        data: { isPosted: true, postedAt: new Date(), journalEntryId: je.id },
      });
    });

    return posted;
  }

  /**
   * Unpost a securities renewal: reverses the fee journal entry (if any) and
   * restores the party balance.
   */
  async unpostSecuritiesRenewal(
    companyId: string,
    renewalId: string,
    ctx: SecuritiesRenewalPostingCtx
  ) {
    const renewal = await this.getSecuritiesRenewalById(companyId, renewalId);

    if (!renewal.isPosted) {
      throw new Error('Securities renewal is not posted');
    }

    if (!renewal.journalEntryId) {
      return prisma.securitiesRenewal.update({
        where: { id: renewalId },
        data: { isPosted: false, postedAt: null },
      });
    }

    const fee = renewal.renewalFee ? Number(renewal.renewalFee) : 0;
    const { customerId, supplierId } = renewal.originalSecurityId && renewal.originalSecurityType
      ? await this.resolveOriginalSecurityParty(
          companyId,
          renewal.originalSecurityId,
          renewal.originalSecurityType
        )
      : { customerId: null, supplierId: null };
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, new Date());

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(
        tx,
        { companyId, branchId: ctx.branchId?.trim() || undefined, fiscalYearId, userId: ctx.userId },
        renewal.journalEntryId!,
        { reason: 'Securities renewal unposted' }
      );

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { decrement: new Decimal(fee) } },
        });
      }
      if (supplierId) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balance: { decrement: new Decimal(fee) } },
        });
      }

      return tx.securitiesRenewal.update({
        where: { id: renewalId },
        data: { isPosted: false, postedAt: null, journalEntryId: null },
      });
    });
  }

  /**
   * Cancel a securities renewal
   */
  async cancelSecuritiesRenewal(companyId: string, renewalId: string) {
    const renewal = await this.getSecuritiesRenewalById(companyId, renewalId);

    if (renewal.isPosted) {
      throw new Error('Cannot cancel a posted securities renewal. Unpost it first.');
    }

    if (renewal.isCancelled) {
      throw new Error('Securities renewal is already cancelled');
    }

    return prisma.securitiesRenewal.update({
      where: { id: renewalId },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Restore a cancelled securities renewal
   */
  async restoreSecuritiesRenewal(companyId: string, renewalId: string) {
    const renewal = await this.getSecuritiesRenewalById(companyId, renewalId);

    if (!renewal.isCancelled) {
      throw new Error('Securities renewal is not cancelled');
    }

    return prisma.securitiesRenewal.update({
      where: { id: renewalId },
      data: {
        isCancelled: false,
        cancelledAt: null,
      },
    });
  }
}

export const securitiesRenewalService = new SecuritiesRenewalService();

