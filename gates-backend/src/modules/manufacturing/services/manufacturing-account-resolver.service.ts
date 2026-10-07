import prisma from '../../../shared/database/prisma';
import { SYSTEM_GL_CODES } from '../../accounting/data/system-account-map';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';

/** Egyptian COA template codes (see coa-template.data.ts). */
const DEFAULTS = {
  wipMaterialsAccountCode: '1143',
  wipLaborOverheadAccountCode: '1143',
  rawInventoryAccountCode: '1142',
  finishedGoodsAccountCode: '1141',
  overheadAbsorptionAccountCode: SYSTEM_GL_CODES.subcontractorCost,
};

const LEGACY_CODE_MAP: Record<string, string> = {
  '1501': DEFAULTS.wipMaterialsAccountCode,
  '1502': DEFAULTS.wipLaborOverheadAccountCode,
  '1310': DEFAULTS.rawInventoryAccountCode,
  '1320': DEFAULTS.finishedGoodsAccountCode,
  '5205': DEFAULTS.overheadAbsorptionAccountCode,
};

function normalizeManufacturingAccountCode(codeOrId: string | null | undefined, fallback: string): string {
  const raw = (codeOrId && codeOrId.trim()) || fallback;
  return LEGACY_CODE_MAP[raw] ?? raw;
}

export class ManufacturingAccountResolverService {
  async getSettings(companyId: string) {
    return prisma.manufacturingSettings.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  private async resolvePosting(
    companyId: string,
    configured: string | null | undefined,
    defaultCode: string
  ): Promise<string> {
    const code = normalizeManufacturingAccountCode(configured, defaultCode);
    const fallbacks = [
      defaultCode,
      SYSTEM_GL_CODES.inventory,
      SYSTEM_GL_CODES.cogs,
      SYSTEM_GL_CODES.subcontractorCost,
    ];
    return invoiceAccountResolverService.resolvePostingAccountId(companyId, code, fallbacks);
  }

  async resolveAccounts(companyId: string) {
    const settings = await this.getSettings(companyId);
    return {
      wipMaterialsAccountId: await this.resolvePosting(
        companyId,
        settings.wipMaterialsAccountCode,
        DEFAULTS.wipMaterialsAccountCode
      ),
      wipLaborOverheadAccountId: await this.resolvePosting(
        companyId,
        settings.wipLaborOverheadAccountCode,
        DEFAULTS.wipLaborOverheadAccountCode
      ),
      rawInventoryAccountId: await this.resolvePosting(
        companyId,
        settings.rawInventoryAccountCode,
        DEFAULTS.rawInventoryAccountCode
      ),
      finishedGoodsAccountId: await this.resolvePosting(
        companyId,
        settings.finishedGoodsAccountCode,
        DEFAULTS.finishedGoodsAccountCode
      ),
      overheadAbsorptionAccountId: await this.resolvePosting(
        companyId,
        settings.overheadAbsorptionAccountCode,
        DEFAULTS.overheadAbsorptionAccountCode
      ),
    };
  }

  async resolveWarehouseInventoryAccountId(
    companyId: string,
    warehouseInventoryAccountId: string | null | undefined,
    fallbackCode: string
  ): Promise<string> {
    if (warehouseInventoryAccountId?.trim()) {
      return this.resolvePosting(companyId, warehouseInventoryAccountId, fallbackCode);
    }
    return this.resolvePosting(companyId, null, fallbackCode);
  }
}

export const manufacturingAccountResolverService =
  new ManufacturingAccountResolverService();
