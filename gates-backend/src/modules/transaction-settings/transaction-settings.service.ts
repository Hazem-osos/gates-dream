import type { DocumentBaseType, Prisma, TransactionSettings } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { invoiceModuleSettingsService } from '../platform/services/invoice-module-settings.service';
import type {
  TransactionDocumentType,
  UpdateTransactionSettingsInput,
} from './transaction-settings.schema';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

export function invoiceKindToDocumentType(
  kind: string
): TransactionDocumentType | null {
  if (kind === 'SALE') return 'SALES_INVOICE';
  if (kind === 'SALE_RETURN') return 'SALES_RETURN';
  if (kind === 'PURCHASE') return 'PURCHASE_INVOICE';
  if (kind === 'PURCHASE_RETURN') return 'PURCHASE_RETURN';
  return null;
}

const settingsInclude = {
  defaultSalesAccount: { select: { id: true, code: true, arabicName: true } },
  defaultPurchaseReturnAccount: { select: { id: true, code: true, arabicName: true } },
  defaultCostCenter: { select: { id: true, code: true, arabicName: true } },
  defaultWarehouse: { select: { id: true, code: true, arabicName: true } },
} satisfies Prisma.TransactionSettingsInclude;

export type TransactionSettingsDto = TransactionSettings & {
  defaultSalesAccount: { id: string; code: string; arabicName: string } | null;
  defaultPurchaseReturnAccount: { id: string; code: string; arabicName: string } | null;
  defaultCostCenter: { id: string; code: string; arabicName: string } | null;
  defaultWarehouse: { id: string; code: string | null; arabicName: string } | null;
};

async function seedFromLegacy(
  companyId: string,
  documentType: TransactionDocumentType
): Promise<Prisma.TransactionSettingsUncheckedCreateInput> {
  // Unchecked scalars only. The tenant-scoping extension stamps `companyId`
  // onto every create; mixing that with `company: { connect }` is rejected
  // by Prisma as "Unknown argument companyId".
  const base: Prisma.TransactionSettingsUncheckedCreateInput = {
    companyId,
    documentType: documentType as DocumentBaseType,
  };
  if (documentType !== 'SALES_INVOICE' && documentType !== 'PURCHASE_INVOICE') {
    return base;
  }
  const formType = documentType === 'SALES_INVOICE' ? 'SI01' : 'PI01';
  const legacy = await invoiceModuleSettingsService.resolve(companyId, formType);
  const seeded: Prisma.TransactionSettingsUncheckedCreateInput = {
    ...base,
    numberingMode: legacy.serialAutomatic === 'A' ? 'AUTOMATIC' : 'MANUAL',
    sequenceMode: legacy.serialContanious === 'C' ? 'CONTINUOUS' : 'ANNUAL_RESET',
    autoPostOnSave: legacy.autoPost,
    autoPrintOnSave: legacy.autoPrint,
    generateEntryOnSave: !legacy.notCreateGL,
    affectStock: legacy.postTostore,
    allowItemPriceOverride: legacy.allowChangePrice,
    cascadingDiscounts: legacy.cascadingDiscounts,
    showAllAccountsInCustomerField: legacy.selectAllAccounts,
    autoApplyVat: legacy.salesDariba,
    autoApplyWht: legacy.manbaDariba,
    costCenterSide: legacy.ccenterSide === 'C' ? 'CREDIT' : 'DEBIT',
  };
  const costCenterId = asUuid(legacy.ccenter);
  const warehouseId = asUuid(legacy.defaultStore);
  if (costCenterId) seeded.defaultCostCenterId = costCenterId;
  if (warehouseId) seeded.defaultWarehouseId = warehouseId;
  return seeded;
}

export class TransactionSettingsService {
  async getOrCreate(
    companyId: string,
    documentType: TransactionDocumentType
  ): Promise<TransactionSettingsDto> {
    const existing = await prisma.transactionSettings.findUnique({
      where: { companyId_documentType: { companyId, documentType } },
      include: settingsInclude,
    });
    if (existing) return existing;

    const data = await seedFromLegacy(companyId, documentType);
    try {
      return await prisma.transactionSettings.create({
        data,
        include: settingsInclude,
      });
    } catch {
      const raced = await prisma.transactionSettings.findUnique({
        where: { companyId_documentType: { companyId, documentType } },
        include: settingsInclude,
      });
      if (raced) return raced;
      const { defaultCostCenterId: _cc, defaultWarehouseId: _wh, ...safe } = data;
      return prisma.transactionSettings.create({
        data: safe,
        include: settingsInclude,
      });
    }
  }

  async update(
    companyId: string,
    documentType: TransactionDocumentType,
    patch: UpdateTransactionSettingsInput
  ): Promise<TransactionSettingsDto> {
    await this.getOrCreate(companyId, documentType);
    if (patch.defaultSalesAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: patch.defaultSalesAccountId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw new AppError(422, 'حساب المبيعات الافتراضي غير موجود');
    }
    if (patch.defaultPurchaseReturnAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: patch.defaultPurchaseReturnAccountId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw new AppError(422, 'حساب مردودات المشتريات الافتراضي غير موجود');
    }
    if (patch.defaultCostCenterId) {
      const center = await prisma.costCenter.findFirst({
        where: { id: patch.defaultCostCenterId, companyId },
        select: { id: true },
      });
      if (!center) throw new AppError(422, 'مركز التكلفة الافتراضي غير موجود');
    }
    if (patch.defaultWarehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: patch.defaultWarehouseId, companyId },
        select: { id: true },
      });
      if (!warehouse) throw new AppError(422, 'المخزن الافتراضي غير موجود');
    }

    return prisma.transactionSettings.update({
      where: { companyId_documentType: { companyId, documentType } },
      data: patch,
      include: settingsInclude,
    });
  }
}

export const transactionSettingsService = new TransactionSettingsService();
