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
}

export const recurringEntriesService = new RecurringEntriesService();
