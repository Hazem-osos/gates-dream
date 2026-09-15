import { Decimal } from '@prisma/client/runtime/library';
import { RecurringFrequency } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type { CreateRecurringEntryInput } from '../schemas/recurring-entry.schema';

function lineTotal(lines: CreateRecurringEntryInput['lines']): Decimal {
  const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  return new Decimal(Math.max(debit, credit).toFixed(2));
}

export class RecurringEntriesService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const search = options?.search?.trim();
    const rows = await prisma.recurringJournalEntry.findMany({
      where: {
        companyId,
        ...(options?.includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { templateNameAr: { contains: search } },
                { notes: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, arabicName: true } },
            costCenter: { select: { id: true, code: true, arabicName: true } },
          },
        },
      },
      orderBy: { templateNameAr: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      templateNameAr: row.templateNameAr,
      frequency: row.frequency,
      notes: row.notes,
      totalAmount: Number(row.totalAmount),
      isActive: row.isActive,
      lastGeneratedAt: row.lastGeneratedAt,
      lines: row.lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        accountName: line.account.arabicName,
        accountCode: line.account.code,
        costCenterId: line.costCenterId,
        costCenterName: line.costCenter?.arabicName ?? null,
        description: line.description,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    }));
  }

  async create(companyId: string, data: CreateRecurringEntryInput) {
    const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new AppError(400, 'أحد حسابات القيد الدوري غير موجود في الشركة');
    }

    const created = await prisma.recurringJournalEntry.create({
      data: {
        companyId,
        templateNameAr: data.templateNameAr.trim(),
        frequency: data.frequency ?? RecurringFrequency.MONTHLY,
        notes: data.notes?.trim() || null,
        totalAmount: lineTotal(data.lines),
        lines: {
          create: data.lines.map((line) => ({
            accountId: line.accountId,
            costCenterId: line.costCenterId || null,
            description: line.description?.trim() || null,
            debit: new Decimal(line.debit || 0),
            credit: new Decimal(line.credit || 0),
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, arabicName: true } },
          },
        },
      },
    });

    logger.info({ companyId, recurringEntryId: created.id }, 'Recurring journal template created');
    return created;
  }

  async markGenerated(companyId: string, templateId: string) {
    await prisma.recurringJournalEntry.updateMany({
      where: { id: templateId, companyId },
      data: { lastGeneratedAt: new Date() },
    });
  }

  /**
   * Checking «سند دوري» on a journal voucher must also persist a template
   * so it appears under «استدعاء قيد دوري». Re-saving updates the same
   * template when `sourceId` already points at one.
   */
  async upsertFromJournal(
    companyId: string,
    journal: {
      id: string;
      sourceId?: string | null;
      description?: string | null;
      voucherNumber?: string | null;
      date: Date;
      lines: Array<{
        accountId: string;
        costCenterId?: string | null;
        description?: string | null;
        debit: number;
        credit: number;
      }>;
    }
  ): Promise<{ id: string; templateNameAr: string }> {
    const lines = journal.lines.filter((line) => {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      return Boolean(line.accountId) && (debit > 0) !== (credit > 0);
    });
    if (lines.length < 2) {
      throw new AppError(
        400,
        'القيد الدوري يحتاج سطرين على الأقل (مدين ودائن) حتى يظهر في قائمة القيود الدورية.'
      );
    }

    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new AppError(400, 'أحد حسابات القيد الدوري غير موجود في الشركة');
    }

    const baseName = (
      journal.description?.trim() ||
      journal.voucherNumber?.trim() ||
      `قيد دوري ${journal.date.toISOString().slice(0, 10)}`
    ).slice(0, 180);

    const existing = journal.sourceId
      ? await prisma.recurringJournalEntry.findFirst({
          where: { id: journal.sourceId, companyId },
        })
      : null;

    const templateNameAr = existing
      ? (journal.description?.trim() || existing.templateNameAr).slice(0, 191)
      : await this.uniqueTemplateName(companyId, baseName);

    const lineRows = lines.map((line) => ({
      accountId: line.accountId,
      costCenterId: line.costCenterId || null,
      description: line.description?.trim() || null,
      debit: new Decimal(line.debit || 0),
      credit: new Decimal(line.credit || 0),
    }));
    const totalAmount = lineTotal(lines);

    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.recurringJournalLine.deleteMany({
          where: { recurringEntryId: existing.id },
        });
        await tx.recurringJournalEntry.update({
          where: { id: existing.id },
          data: {
            templateNameAr,
            notes: journal.description?.trim() || existing.notes,
            totalAmount,
            isActive: true,
            lines: { create: lineRows },
          },
        });
      });
      return { id: existing.id, templateNameAr };
    }

    const created = await prisma.recurringJournalEntry.create({
      data: {
        companyId,
        templateNameAr,
        frequency: RecurringFrequency.MONTHLY,
        notes: journal.description?.trim() || null,
        totalAmount,
        isActive: true,
        lines: { create: lineRows },
      },
    });
    logger.info(
      { companyId, recurringEntryId: created.id, journalEntryId: journal.id },
      'Recurring journal template created from cyclic voucher'
    );
    return { id: created.id, templateNameAr };
  }

  private async uniqueTemplateName(companyId: string, baseName: string): Promise<string> {
    const clash = await prisma.recurringJournalEntry.findFirst({
      where: { companyId, templateNameAr: baseName },
      select: { id: true },
    });
    if (!clash) return baseName;
    const suffix = ` (${Date.now().toString().slice(-6)})`;
    return `${baseName.slice(0, 191 - suffix.length)}${suffix}`;
  }
}

export const recurringEntriesService = new RecurringEntriesService();
