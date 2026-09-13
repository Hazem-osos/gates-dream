import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { companySettingService } from '../../platform/services/company-setting.service';
import { invoiceModuleSettingsService } from '../../platform/services/invoice-module-settings.service';
import { newModuleService } from '../../platform/services/new-module.service';
import {
  invoiceKindToDocumentType,
  transactionSettingsService,
} from '../../transaction-settings/transaction-settings.service';
import type { InvoiceKind } from '../types/invoice-posting.types';

export const INVOICE_KIND_BASE_TYPE: Record<InvoiceKind, string> = {
  SALE: 'SI',
  PURCHASE: 'PI',
  SALE_RETURN: 'SR',
  PURCHASE_RETURN: 'PR',
};

export function invoiceKindToBaseType(kind: InvoiceKind): string {
  return INVOICE_KIND_BASE_TYPE[kind];
}

/** Always-present default/base type for each family (`SI01`, `PI01`, …). */
export function defaultInvoiceModuleCode(kind: InvoiceKind): string {
  return `${INVOICE_KIND_BASE_TYPE[kind]}01`;
}

export function invoiceSequenceDocType(kind: InvoiceKind): string {
  switch (kind) {
    case 'PURCHASE':
      return 'INV-PI';
    case 'PURCHASE_RETURN':
      return 'INV-PR';
    case 'SALE_RETURN':
      return 'INV-SR';
    case 'SALE':
    default:
      return 'INV-SI';
  }
}

export function invoiceKindFromLegacyType(invoiceType: string): InvoiceKind {
  if (invoiceType === 'purchase') return 'PURCHASE';
  if (invoiceType === 'sales') return 'SALE';
  return 'SALE';
}

export interface ResolvedInvoiceModule {
  newModuleId: string | null;
  moduleCode: string;
}

/**
 * Resolve the 4-char settings/numbering suffix for an invoice.
 *
 * Priority: explicit `newModuleId` (via `resolveFullCode`) → explicit
 * `moduleCode` looked up in the registry → the family's default `*01`.
 * A supplied module whose `baseType` does not match the invoice kind is
 * rejected so a purchase cannot silently number as `SI02`.
 */
export async function resolveInvoiceModule(
  companyId: string,
  kind: InvoiceKind,
  opts?: { newModuleId?: string | null; moduleCode?: string | null }
): Promise<ResolvedInvoiceModule> {
  const expectedBase = invoiceKindToBaseType(kind);

  if (opts?.newModuleId) {
    const row = await newModuleService.getById(companyId, opts.newModuleId);
    if (!row.isActive) {
      throw new AppError(422, `Document type ${row.fullCode} is inactive`);
    }
    if (row.baseType !== expectedBase) {
      throw new AppError(
        422,
        `Document type ${row.fullCode} does not match invoice kind ${kind}`
      );
    }
    return { newModuleId: row.id, moduleCode: row.fullCode };
  }

  if (opts?.moduleCode) {
    const fullCode = opts.moduleCode.trim().toUpperCase();
    if (fullCode.slice(0, 2) !== expectedBase) {
      throw new AppError(
        422,
        `Document type ${fullCode} does not match invoice kind ${kind}`
      );
    }
    const row = await newModuleService.findByFullCode(companyId, fullCode);
    if (row && !row.isActive) {
      throw new AppError(422, `Document type ${fullCode} is inactive`);
    }
    return { newModuleId: row?.id ?? null, moduleCode: fullCode };
  }

  return { newModuleId: null, moduleCode: defaultInvoiceModuleCode(kind) };
}

export async function assertModuleWarehouseAllowed(
  companyId: string,
  newModuleId: string | null,
  warehouseId: string
): Promise<void> {
  if (!newModuleId) return;
  const allowed = await newModuleService.isWarehouseAllowed(companyId, newModuleId, warehouseId);
  if (!allowed) {
    throw new AppError(422, 'Warehouse is not permitted for this document type');
  }
}

export async function resolveInvoiceModuleSettings(
  companyId: string,
  moduleCode: string
) {
  return invoiceModuleSettingsService.resolve(companyId, moduleCode);
}

/**
 * Save-time auto-post. Company `DirectAffectStore` / `DirectAffectMoney`
 * (legacy default `'F'`) or an *explicit* `AutoPost{Module}='T'` fire it.
 *
 * `invoiceModuleSettingsService.autoPost` uses the legacy LoadSettings
 * polarity (true unless the row is `'F'`). Honoring that here would
 * auto-post every unconfigured invoice on save — the same conservative
 * deviation documented for `AllowMinusQty`.
 */
export async function shouldAutoPostOnSave(
  companyId: string,
  moduleCode: string
): Promise<boolean> {
  const [directStore, directMoney, autoPostRow, settings] = await Promise.all([
    companySettingService.getFlag(companyId, 'DirectAffectStore', false),
    companySettingService.getFlag(companyId, 'DirectAffectMoney', false),
    companySettingService.getModuleEntry(companyId, 'AutoPost', moduleCode),
    prisma.companySettings.findUnique({
      where: { companyId },
      select: { autoPostGl: true },
    }),
  ]);
  if (settings?.autoPostGl === false) return false;
  const docType = invoiceKindToDocumentType(moduleCode.startsWith('PI') ? 'PURCHASE' : 'SALE');
  if (docType) {
    const txSettings = await prisma.transactionSettings.findUnique({
      where: { companyId_documentType: { companyId, documentType: docType } },
      select: { autoPostOnSave: true },
    });
    if (txSettings?.autoPostOnSave) return true;
  }
  return directStore || directMoney || autoPostRow === 'T';
}

/** `CheckMinusQty{Module}` — off only when the row is explicitly `'F'`. */
export async function shouldCheckMinusQtyOnDraft(
  companyId: string,
  moduleCode: string
): Promise<boolean> {
  const docType = invoiceKindToDocumentType(moduleCode.startsWith('PI') ? 'PURCHASE' : 'SALE');
  if (docType) {
    const txSettings = await prisma.transactionSettings.findUnique({
      where: { companyId_documentType: { companyId, documentType: docType } },
      select: { preventNegativeStock: true, affectStock: true },
    });
    if (txSettings) return txSettings.preventNegativeStock && txSettings.affectStock;
  }
  return companySettingService.getModuleFlag(companyId, 'CheckMinusQty', moduleCode, {
    offLiteral: 'F',
  });
}

export async function loadInvoiceTransactionSettings(
  companyId: string,
  kind: InvoiceKind
) {
  const documentType = invoiceKindToDocumentType(kind);
  if (!documentType) return null;
  return transactionSettingsService.getOrCreate(companyId, documentType);
}
