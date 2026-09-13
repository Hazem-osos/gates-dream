import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { companySettingService } from '../../platform/services/company-setting.service';
import { accountService } from './account.service';

type AccountDefs = Record<string, string | undefined>;

function isBlankSetting(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  return lower === 'nothing' || lower === 'null' || lower === 'undefined';
}

/**
 * Ensures every customer has a dedicated AR sub-account under حساب العملاء.
 * The company-wide control account is a parent only — invoices and collections
 * must hit the customer's own leaf account.
 */
export class CustomerLedgerAccountService {
  async resolveControlAccountId(
    companyId: string,
    branchId?: string | null
  ): Promise<string | null> {
    const ids = await this.resolveControlAccountIds(companyId, branchId);
    return ids[0] ?? null;
  }

  async resolveControlAccountIds(
    companyId: string,
    branchId?: string | null
  ): Promise<string[]> {
    const raw: string[] = [];
    const legacy = await companySettingService.getEntry(companyId, 'CustomersAccount', {
      branchId,
    });
    if (!isBlankSetting(legacy)) raw.push(legacy!.trim());

    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { accountDefinitions: true },
    });
    const defs = (settings?.accountDefinitions ?? {}) as AccountDefs;
    for (const key of ['arAccount', 'customerAccount', 'customersAccount', 'salesDebtorAccount']) {
      const v = defs[key];
      if (typeof v === 'string' && !isBlankSetting(v)) raw.push(v.trim());
    }

    const resolved: string[] = [];
    const seen = new Set<string>();
    for (const token of raw) {
      const id = await this.lookupAccountId(companyId, token);
      if (id && !seen.has(id)) {
        seen.add(id);
        resolved.push(id);
      }
    }
    return resolved;
  }

  /**
   * Returns the customer's personal AR account, creating one if they are still
   * pointing at the shared control account (or have none).
   */
  async ensureForCustomer(params: {
    companyId: string;
    customerId: string;
    branchId?: string | null;
    requestedAccountId?: string | null;
  }): Promise<string> {
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, companyId: params.companyId },
      select: {
        id: true,
        arabicName: true,
        englishName: true,
        code: true,
        serial: true,
        mainAccountId: true,
        accountId: true,
      },
    });
    if (!customer) {
      throw new AppError(404, 'العميل غير موجود');
    }

    const controlIds = await this.resolveControlAccountIds(params.companyId, params.branchId);
    const controlSet = new Set(controlIds);

    const candidates = [
      params.requestedAccountId,
      customer.mainAccountId,
      customer.accountId,
    ].filter((id): id is string => Boolean(id && id.trim()));

    for (const candidate of candidates) {
      if (controlSet.has(candidate)) continue;
      const exists = await prisma.account.findFirst({
        where: { id: candidate, companyId: params.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) continue;
      if (customer.mainAccountId !== exists.id || customer.accountId !== exists.id) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { mainAccountId: exists.id, accountId: exists.id },
        });
      }
      return exists.id;
    }

    const parentId = controlIds[0];
    if (!parentId) {
      throw new AppError(
        422,
        'حساب العملاء الافتراضي غير مضبوط — اضبطه من إعدادات الحسابات ثم أعد المحاولة'
      );
    }

    const created = await this.createChildAccount({
      companyId: params.companyId,
      parentId,
      customerName: customer.arabicName,
      englishName: customer.englishName,
      customerCode: customer.code,
      customerSerial: customer.serial,
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { mainAccountId: created.id, accountId: created.id },
    });

    logger.info(
      { companyId: params.companyId, customerId: customer.id, accountId: created.id },
      'Created personal AR account for customer'
    );
    return created.id;
  }

  private async lookupAccountId(companyId: string, codeOrId: string): Promise<string | null> {
    const byId = await prisma.account.findFirst({
      where: { id: codeOrId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (byId) return byId.id;
    const byCode = await prisma.account.findFirst({
      where: { code: codeOrId, companyId, deletedAt: null },
      select: { id: true },
    });
    return byCode?.id ?? null;
  }

  private async createChildAccount(params: {
    companyId: string;
    parentId: string;
    customerName: string;
    englishName?: string | null;
    customerCode?: string | null;
    customerSerial?: string | null;
  }) {
    const parent = await prisma.account.findFirst({
      where: { id: params.parentId, companyId: params.companyId, deletedAt: null },
      select: {
        id: true,
        code: true,
        accountType: true,
        accountNature: true,
        accountSide: true,
        statementType: true,
        requiresCostCenter: true,
        costCenterRequired: true,
      },
    });
    if (!parent) {
      throw new AppError(422, 'حساب العملاء الافتراضي غير موجود في دليل الحسابات');
    }

    const preferredCode = this.preferredChildCode(
      parent.code,
      params.customerCode,
      params.customerSerial
    );
    const codesToTry: string[] = [];
    if (preferredCode) codesToTry.push(preferredCode);
    const suggested = await accountService.suggestNextAccountCode(params.companyId, parent.id);
    if (!codesToTry.includes(suggested)) codesToTry.push(suggested);

    const arabicName = params.customerName.trim() || 'عميل';
    let lastError: unknown;
    for (const code of codesToTry) {
      const existing = await prisma.account.findFirst({
        where: { companyId: params.companyId, code, deletedAt: null },
        select: { id: true, parentId: true },
      });
      if (existing) {
        if (existing.parentId === parent.id) return existing;
        continue;
      }
      try {
        return await accountService.createAccount(params.companyId, {
          code,
          arabicName,
          englishName: params.englishName ?? undefined,
          accountType: parent.accountType ?? undefined,
          parentId: parent.id,
          accountNature: parent.accountNature,
          accountSide: parent.accountSide ?? undefined,
          statementType: parent.statementType,
          requiresCostCenter: parent.requiresCostCenter,
          costCenterRequired: parent.costCenterRequired ?? undefined,
        });
      } catch (error) {
        lastError = error;
        logger.warn({ error, code, companyId: params.companyId }, 'Customer AR account code collision');
      }
    }

    for (let i = 0; i < 5; i += 1) {
      const code = await accountService.suggestNextAccountCode(params.companyId, parent.id);
      try {
        return await accountService.createAccount(params.companyId, {
          code,
          arabicName,
          englishName: params.englishName ?? undefined,
          accountType: parent.accountType ?? undefined,
          parentId: parent.id,
          accountNature: parent.accountNature,
          accountSide: parent.accountSide ?? undefined,
          statementType: parent.statementType,
          requiresCostCenter: parent.requiresCostCenter,
          costCenterRequired: parent.costCenterRequired ?? undefined,
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AppError(500, 'تعذر إنشاء حساب العميل');
  }

  private preferredChildCode(
    parentCode: string,
    customerCode?: string | null,
    customerSerial?: string | null
  ): string | null {
    const suffix = this.sanitizeCodePart(customerCode) || this.sanitizeCodePart(customerSerial);
    if (!suffix) return null;
    return `${parentCode}${suffix}`;
  }

  private sanitizeCodePart(value?: string | null): string {
    if (!value) return '';
    return value.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, '').slice(0, 16);
  }
}

export const customerLedgerAccountService = new CustomerLedgerAccountService();
