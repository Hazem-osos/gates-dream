import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';

export interface CreateCurrencyData {
  serial?: number | null;
  code: string;
  symbol?: string | null;
  arabicName: string;
  englishName?: string;
  exchangeRate?: number | null;
}

export interface UpdateCurrencyData extends Partial<CreateCurrencyData> {
  isActive?: boolean;
}

const DEFAULT_SYMBOLS: Record<string, string> = {
  EGP: 'ج.م',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  JOD: 'د.أ',
};

export class CurrencyService {
  private async nextSerial(companyId: string): Promise<number> {
    const latest = await prisma.currency.findFirst({
      where: { companyId, serial: { not: null } },
      orderBy: { serial: 'desc' },
      select: { serial: true },
    });
    return (latest?.serial ?? 0) + 1;
  }

  private async assertUnused(companyId: string, currencyId: string, code: string, action: string) {
    const [invoices, quotes, orders, returns] = await Promise.all([
      prisma.invoice.count({ where: { companyId, OR: [{ currencyId }, { currencyCode: code }] } }),
      prisma.priceQuote.count({ where: { companyId, currencyId } }),
      prisma.purchaseOrder.count({ where: { companyId, currencyId } }),
      prisma.purchaseReturn.count({ where: { companyId, currencyId } }),
    ]);
    const total = invoices + quotes + orders + returns;
    if (total === 0) return;
    const parts = [
      invoices > 0 ? `${invoices} فاتورة` : null,
      quotes > 0 ? `${quotes} عرض سعر` : null,
      orders > 0 ? `${orders} أمر شراء` : null,
      returns > 0 ? `${returns} مرتجع` : null,
    ].filter(Boolean);
    throw new AppError(
      422,
      `لا يمكن ${action} العملة لأن عليها ${parts.join(' و')}.`
    );
  }

  async createCurrency(companyId: string, data: CreateCurrencyData) {
    const code = data.code.trim().toUpperCase();
    const clash = await prisma.currency.findFirst({ where: { companyId, code } });
    if (clash) {
      throw new AppError(409, 'رمز العملة مستخدم من قبل');
    }

    const serial = data.serial && data.serial > 0 ? data.serial : await this.nextSerial(companyId);
    const serialClash = await prisma.currency.findFirst({ where: { companyId, serial } });
    if (serialClash) {
      throw new AppError(409, 'مسلسل العملة مستخدم من قبل');
    }

    const currency = await prisma.currency.create({
      data: {
        companyId,
        serial,
        code,
        symbol: data.symbol?.trim() || DEFAULT_SYMBOLS[code] || null,
        arabicName: data.arabicName,
        englishName: data.englishName,
        exchangeRate: data.exchangeRate ? new Decimal(data.exchangeRate) : null,
      },
    });

    logger.info({ companyId, currencyId: currency.id }, 'Currency created');
    return currency;
  }

  async getCurrencyById(companyId: string, currencyId: string) {
    const currency = await prisma.currency.findFirst({
      where: { id: currencyId, companyId },
    });
    if (!currency) {
      throw new AppError(404, 'العملة غير موجودة');
    }
    return currency;
  }

  async getCurrencyByCode(companyId: string, code: string) {
    const currency = await prisma.currency.findFirst({
      where: { companyId, code },
    });
    if (!currency) {
      throw new AppError(404, 'العملة غير موجودة');
    }
    return currency;
  }

  async listCurrencies(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const search = options.search?.trim();

    const where: {
      companyId: string;
      isActive?: boolean;
      OR?: Array<Record<string, unknown>>;
    } = { companyId };

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (search) {
      const asNumber = Number(search);
      where.OR = [
        { arabicName: { contains: search } },
        { englishName: { contains: search } },
        { code: { contains: search } },
        { symbol: { contains: search } },
        ...(Number.isFinite(asNumber) ? [{ serial: asNumber }] : []),
      ];
    }

    const [currencies, total] = await Promise.all([
      prisma.currency.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ serial: 'asc' }, { code: 'asc' }],
      }),
      prisma.currency.count({ where }),
    ]);

    return {
      currencies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCurrency(companyId: string, currencyId: string, data: UpdateCurrencyData) {
    const existing = await this.getCurrencyById(companyId, currencyId);
    await this.assertUnused(companyId, currencyId, existing.code, 'تعديل');

    if (data.code && data.code.trim().toUpperCase() !== existing.code) {
      const clash = await prisma.currency.findFirst({
        where: { companyId, code: data.code.trim().toUpperCase(), id: { not: currencyId } },
      });
      if (clash) {
        throw new AppError(409, 'رمز العملة مستخدم من قبل');
      }
    }

    if (data.serial != null && data.serial !== existing.serial) {
      const clash = await prisma.currency.findFirst({
        where: { companyId, serial: data.serial, id: { not: currencyId } },
      });
      if (clash) {
        throw new AppError(409, 'مسلسل العملة مستخدم من قبل');
      }
    }

    const code = data.code ? data.code.trim().toUpperCase() : existing.code;

    const currency = await prisma.currency.update({
      where: { id: currencyId },
      data: {
        ...(data.serial !== undefined && data.serial != null ? { serial: data.serial } : {}),
        ...(data.code !== undefined ? { code } : {}),
        ...(data.symbol !== undefined
          ? { symbol: data.symbol?.trim() || DEFAULT_SYMBOLS[code] || null }
          : {}),
        ...(data.arabicName !== undefined ? { arabicName: data.arabicName } : {}),
        ...(data.englishName !== undefined ? { englishName: data.englishName } : {}),
        ...(data.exchangeRate !== undefined
          ? { exchangeRate: data.exchangeRate ? new Decimal(data.exchangeRate) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    logger.info({ companyId, currencyId }, 'Currency updated');
    return currency;
  }

  async deleteCurrency(companyId: string, currencyId: string) {
    const currency = await this.getCurrencyById(companyId, currencyId);
    await this.assertUnused(companyId, currencyId, currency.code, 'حذف');
    await prisma.currency.delete({ where: { id: currencyId } });
    logger.info({ companyId, currencyId }, 'Currency deleted');
    return { success: true };
  }
}

export const currencyService = new CurrencyService();
