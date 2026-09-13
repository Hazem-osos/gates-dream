import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateLetterOfGuaranteeData {
  serial?: string;
  description?: string;
  guaranteeAccountId?: string | null;
  guaranteeAccountName?: string;
  letterType?: 'incoming' | 'outgoing';
  letterNumber?: string;
  issueDate?: Date | string | null;
  issueDateHijri?: string;
  expiryDate?: Date | string | null;
  expiryDateHijri?: string;
  letterValue?: number | null;
  bidPercentage?: number | null;
  bidValue?: number | null;
  beneficiary?: string;
  issuingBank?: string;
  incomingParty?: string;
  includesBankExpenses?: boolean;
  expenseAccountId?: string | null;
  expenseAccountName?: string;
  expenseValue?: number | null;
  costCenterId?: string | null;
  costCenterName?: string;
  type?: string;
  currencyId?: string | null;
  currencyName?: string;
  accruedRevenue?: number | null;
  operationsCenter?: string;
  cashCollectionPapers1?: string;
  cashCollectionPapers2?: string;
  cashCollectionPapers3?: string;
  approvalStatus?: 'open' | 'closed';
  entryId?: string | null;
  closingEntryId?: string | null;
  creationEntryId?: string | null;
  date1?: Date | string | null;
  date1Hijri?: string;
  date2?: Date | string | null;
  date2Hijri?: string;
  date3?: Date | string | null;
  date3Hijri?: string;
  date4?: Date | string | null;
  date4Hijri?: string;
  date5?: Date | string | null;
  date5Hijri?: string;
  date6?: Date | string | null;
  date6Hijri?: string;
  date7?: Date | string | null;
  date7Hijri?: string;
  date8?: Date | string | null;
  date8Hijri?: string;
  date9?: Date | string | null;
  date9Hijri?: string;
  date10?: Date | string | null;
  date10Hijri?: string;
  renewedFromId?: string | null;
}

export interface UpdateLetterOfGuaranteeData extends Partial<CreateLetterOfGuaranteeData> {
  isActive?: boolean;
}

export interface RenewLetterOfGuaranteeData {
  expiryDate: Date | string;
  expiryDateHijri?: string;
  letterValue?: number;
  description?: string;
}

const dateFields = ['issueDate', 'expiryDate', 'date1', 'date2', 'date3', 'date4', 'date5', 'date6', 'date7', 'date8', 'date9', 'date10'];
const decimalFields = ['letterValue', 'bidPercentage', 'bidValue', 'expenseValue', 'accruedRevenue'];

function transformData(data: any): any {
  const transformed: any = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      if (dateFields.includes(key)) {
        transformed[key] = data[key] ? new Date(data[key]) : null;
      } else if (decimalFields.includes(key)) {
        transformed[key] = data[key] ? new Decimal(data[key]) : null;
      } else {
        transformed[key] = data[key];
      }
    }
  });
  return transformed;
}

export class LetterOfGuaranteeService {
  async create(companyId: string, data: CreateLetterOfGuaranteeData) {
    try {
      const letter = await prisma.letterOfGuarantee.create({
        data: {
          companyId,
          ...transformData(data),
          letterType: data.letterType || 'incoming',
          approvalStatus: data.approvalStatus || 'closed',
          includesBankExpenses: data.includesBankExpenses ?? false,
        },
      });

      logger.info({ companyId, letterId: letter.id }, 'Letter of guarantee created');
      return letter;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating letter of guarantee');
      throw error;
    }
  }

  async getById(companyId: string, id: string) {
    try {
      const letter = await prisma.letterOfGuarantee.findFirst({
        where: { id, companyId },
        include: {
          renewedFrom: true,
          renewedTo: true,
        },
      });

      if (!letter) {
        throw new Error('Letter of guarantee not found');
      }

      return letter;
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error getting letter of guarantee');
      throw error;
    }
  }

  async list(companyId: string, options: { page?: number; limit?: number; search?: string; letterType?: string; approvalStatus?: string } = {}) {
    try {
      const { page = 1, limit = 100, search, letterType, approvalStatus } = options;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,

      };

      if (search) {
        where.OR = [
          { serial: { contains: search } },
          { description: { contains: search } },
          { letterNumber: { contains: search } },
          { beneficiary: { contains: search } },
        ];
      }

      if (letterType) {
        where.letterType = letterType;
      }

      if (approvalStatus) {
        where.approvalStatus = approvalStatus;
      }

      const [letters, total] = await Promise.all([
        prisma.letterOfGuarantee.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.letterOfGuarantee.count({ where }),
      ]);

      return {
        data: letters,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing letters of guarantee');
      throw error;
    }
  }

  async update(companyId: string, id: string, data: UpdateLetterOfGuaranteeData) {
    try {
      const existing = await prisma.letterOfGuarantee.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Letter of guarantee not found');
      }

      const letter = await prisma.letterOfGuarantee.update({
        where: { id },
        data: transformData(data),
      });

      logger.info({ companyId, id }, 'Letter of guarantee updated');
      return letter;
    } catch (error) {
      logger.error({ error, companyId, id, data }, 'Error updating letter of guarantee');
      throw error;
    }
  }

  async delete(companyId: string, id: string) {
    try {
      const existing = await prisma.letterOfGuarantee.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Letter of guarantee not found');
      }

      await prisma.letterOfGuarantee.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info({ companyId, id }, 'Letter of guarantee deleted');
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error deleting letter of guarantee');
      throw error;
    }
  }

  async renew(companyId: string, id: string, data: RenewLetterOfGuaranteeData) {
    try {
      const existing = await prisma.letterOfGuarantee.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Letter of guarantee not found');
      }

      // Create new letter based on existing one
      const newLetter = await prisma.letterOfGuarantee.create({
        data: {
          companyId,
          serial: existing.serial,
          description: data.description || existing.description,
          guaranteeAccountId: existing.guaranteeAccountId,
          guaranteeAccountName: existing.guaranteeAccountName,
          letterType: existing.letterType,
          letterNumber: existing.letterNumber,
          issueDate: new Date(),
          expiryDate: new Date(data.expiryDate),
          expiryDateHijri: data.expiryDateHijri,
          letterValue: data.letterValue ? new Decimal(data.letterValue) : existing.letterValue,
          bidPercentage: existing.bidPercentage,
          bidValue: existing.bidValue,
          beneficiary: existing.beneficiary,
          issuingBank: existing.issuingBank,
          incomingParty: existing.incomingParty,
          includesBankExpenses: existing.includesBankExpenses,
          expenseAccountId: existing.expenseAccountId,
          expenseAccountName: existing.expenseAccountName,
          costCenterId: existing.costCenterId,
          costCenterName: existing.costCenterName,
          type: existing.type,
          currencyId: existing.currencyId,
          currencyName: existing.currencyName,
          renewedFromId: id,
        },
      });

      // Mark original as renewed
      await prisma.letterOfGuarantee.update({
        where: { id },
        data: { isRenewed: true, renewedAt: new Date() },
      });

      logger.info({ companyId, id, newLetterId: newLetter.id }, 'Letter of guarantee renewed');
      return newLetter;
    } catch (error) {
      logger.error({ error, companyId, id, data }, 'Error renewing letter of guarantee');
      throw error;
    }
  }
}

export const letterOfGuaranteeService = new LetterOfGuaranteeService();

