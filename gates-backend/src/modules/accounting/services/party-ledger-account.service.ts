import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { companySettingService } from '../../platform/services/company-setting.service';
import { accountService } from './account.service';

type AccountDefs = Record<string, string | undefined>;
export type PartyLedgerSide = 'CUSTOMER' | 'SUPPLIER';

function isBlankSetting(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  return lower === 'nothing' || lower === 'null' || lower === 'undefined';
}

const CUSTOMER_SETTING_KEYS = ['CustomersAccount'] as const;
const SUPPLIER_SETTING_KEYS = ['SuppliersAccount'] as const;
const CUSTOMER_DEF_KEYS = [
  'arAccount',
  'customerAccount',
  'customersAccount',
  'salesDebtorAccount',
  'defaultArAccountId',
];
const SUPPLIER_DEF_KEYS = [
  'apAccount',
  'supplierAccount',
  'suppliersAccount',
  'purchaseCreditorAccount',
  'defaultApAccountId',
];
const CUSTOMER_CODES = ['1121', '112', '1200'];
const SUPPLIER_CODES = ['2111', '211', '2100'];
const CUSTOMER_NAMES = [
  'حسابات العملاء التجاريين',
  'حسابات العملاء',
  'العملاء',
  'العملاء والمدينون',
];
const SUPPLIER_NAMES = [
  'حسابات الموردين التجاريين',
  'حسابات الموردين',
  'الموردين',
  'الموردون والدائنون',
];

/**
 * Creates a personal GL leaf under عملاء / موردين using the next tree code.
 */
export class PartyLedgerAccountService {
  async resolveControlAccountId(
    companyId: string,
    branchId?: string | null,
    side: PartyLedgerSide = 'CUSTOMER'
  ): Promise<string | null> {
    const ids = await this.resolveControlAccountIds(companyId, branchId, side);
    return ids[0] ?? null;
  }

  async resolveControlAccountIds(
    companyId: string,
    branchId?: string | null,
    side: PartyLedgerSide = 'CUSTOMER'
  ): Promise<string[]> {
    const raw: string[] = [];
    const settingKeys = side === 'CUSTOMER' ? CUSTOMER_SETTING_KEYS : SUPPLIER_SETTING_KEYS;
    for (const key of settingKeys) {
      const legacy = await companySettingService.getEntry(companyId, key, { branchId });
      if (!isBlankSetting(legacy)) raw.push(legacy!.trim());
    }

    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { accountDefinitions: true },
    });
    const defs = (settings?.accountDefinitions ?? {}) as AccountDefs;
    const defKeys = side === 'CUSTOMER' ? CUSTOMER_DEF_KEYS : SUPPLIER_DEF_KEYS;
    for (const key of defKeys) {
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

    if (resolved.length === 0) {
      const fallback = await this.findControlInTree(companyId, side);
      if (fallback) resolved.push(fallback);
    }

    return resolved;
  }

  async ensureForCustomer(params: {
    companyId: string;
    customerId: string;
    branchId?: string | null;
    requestedAccountId?: string | null;
  }): Promise<string> {
    return this.ensureForParty({
      side: 'CUSTOMER',
      companyId: params.companyId,
      partyId: params.customerId,
      branchId: params.branchId,
      requestedAccountId: params.requestedAccountId,
    });
  }

  async ensureForSupplier(params: {
    companyId: string;
    supplierId: string;
    branchId?: string | null;
    requestedAccountId?: string | null;
  }): Promise<string> {
    return this.ensureForParty({
      side: 'SUPPLIER',
      companyId: params.companyId,
      partyId: params.supplierId,
      branchId: params.branchId,
      requestedAccountId: params.requestedAccountId,
    });
  }

  private async ensureForParty(params: {
    side: PartyLedgerSide;
    companyId: string;
    partyId: string;
    branchId?: string | null;
    requestedAccountId?: string | null;
  }): Promise<string> {
    const party =
      params.side === 'CUSTOMER'
        ? await prisma.customer.findFirst({
            where: { id: params.partyId, companyId: params.companyId },
            select: {
              id: true,
              arabicName: true,
              englishName: true,
              mainAccountId: true,
              accountId: true,
            },
          })
        : await prisma.supplier.findFirst({
            where: { id: params.partyId, companyId: params.companyId },
            select: {
              id: true,
              arabicName: true,
              englishName: true,
              mainAccountId: true,
              accountId: true,
            },
          });

    if (!party) {
      throw new AppError(404, params.side === 'CUSTOMER' ? 'العميل غير موجود' : 'المورد غير موجود');
    }

    const controlIds = await this.resolveControlAccountIds(
      params.companyId,
      params.branchId,
      params.side
    );
    const controlSet = new Set(controlIds);

    const candidates = [
      params.requestedAccountId,
      party.mainAccountId,
      party.accountId,
    ].filter((id): id is string => Boolean(id && id.trim()));

    for (const candidate of candidates) {
      if (controlSet.has(candidate)) continue;
      const exists = await prisma.account.findFirst({
        where: { id: candidate, companyId: params.companyId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      if (!exists) continue;
      const underControl = exists.parentId ? controlSet.has(exists.parentId) : false;
      if (!underControl && controlIds.length > 0) continue;
      await this.linkPartyAccount(params.side, party.id, exists.id);
      return exists.id;
    }

    const parentId = controlIds[0];
    if (!parentId) {
      throw new AppError(
        422,
        params.side === 'CUSTOMER'
          ? 'حساب العملاء غير موجود في دليل الحسابات. أضف حساب «عملاء» ثم أعد المحاولة.'
          : 'حساب الموردين غير موجود في دليل الحسابات. أضف حساب «موردين» ثم أعد المحاولة.'
      );
    }

    const created = await this.createSequentialChild({
      companyId: params.companyId,
      parentId,
      arabicName: party.arabicName,
      englishName: party.englishName,
      side: params.side,
    });

    await this.linkPartyAccount(params.side, party.id, created.id);
    logger.info(
      { companyId: params.companyId, partyId: party.id, accountId: created.id, side: params.side },
      'Created personal party ledger account'
    );
    return created.id;
  }

  private async linkPartyAccount(side: PartyLedgerSide, partyId: string, accountId: string) {
    if (side === 'CUSTOMER') {
      await prisma.customer.update({
        where: { id: partyId },
        data: { mainAccountId: accountId, accountId },
      });
      return;
    }
    await prisma.supplier.update({
      where: { id: partyId },
      data: { mainAccountId: accountId, accountId },
    });
  }

  private async findControlInTree(companyId: string, side: PartyLedgerSide): Promise<string | null> {
    const codes = side === 'CUSTOMER' ? CUSTOMER_CODES : SUPPLIER_CODES;
    const names = side === 'CUSTOMER' ? CUSTOMER_NAMES : SUPPLIER_NAMES;

    for (const code of codes) {
      const byCode = await prisma.account.findFirst({
        where: { companyId, code, deletedAt: null },
        select: { id: true },
      });
      if (byCode) return byCode.id;
    }

    for (const arabicName of names) {
      const byName = await prisma.account.findFirst({
        where: { companyId, arabicName, deletedAt: null },
        select: { id: true },
        orderBy: { code: 'desc' },
      });
      if (byName) return byName.id;
    }

    return null;
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

  private async createSequentialChild(params: {
    companyId: string;
    parentId: string;
    arabicName: string;
    englishName?: string | null;
    side: PartyLedgerSide;
  }) {
    const parent = await prisma.account.findFirst({
      where: { id: params.parentId, companyId: params.companyId, deletedAt: null },
      select: {
        id: true,
        accountType: true,
        accountNature: true,
        accountSide: true,
        statementType: true,
        requiresCostCenter: true,
        costCenterRequired: true,
      },
    });
    if (!parent) {
      throw new AppError(
        422,
        params.side === 'CUSTOMER'
          ? 'حساب العملاء غير موجود في دليل الحسابات'
          : 'حساب الموردين غير موجود في دليل الحسابات'
      );
    }

    const arabicName = params.arabicName.trim() || (params.side === 'CUSTOMER' ? 'عميل' : 'مورد');
    let lastError: unknown;
    for (let i = 0; i < 8; i += 1) {
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
          accountKind: 'POSTING',
          allowParentWithMovements: true,
        });
      } catch (error) {
        lastError = error;
        logger.warn(
          { error, code, companyId: params.companyId, side: params.side },
          'Party ledger account code collision'
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AppError(500, params.side === 'CUSTOMER' ? 'تعذر إنشاء حساب العميل' : 'تعذر إنشاء حساب المورد');
  }
}

export const partyLedgerAccountService = new PartyLedgerAccountService();
export const customerLedgerAccountService = partyLedgerAccountService;
export const supplierLedgerAccountService = partyLedgerAccountService;
