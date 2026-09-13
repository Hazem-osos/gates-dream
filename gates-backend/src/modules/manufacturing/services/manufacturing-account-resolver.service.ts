import prisma from '../../../shared/database/prisma';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';

const DEFAULTS = {
  wipMaterialsAccountCode: '1501',
  wipLaborOverheadAccountCode: '1502',
  rawInventoryAccountCode: '1310',
  finishedGoodsAccountCode: '1320',
  overheadAbsorptionAccountCode: '5205',
};

export class ManufacturingAccountResolverService {
  async getSettings(companyId: string) {
    return prisma.manufacturingSettings.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  async resolveAccounts(companyId: string) {
    const settings = await this.getSettings(companyId);
    const pick = (v: string | null | undefined, d: string) =>
      invoiceAccountResolverService.resolveAccountId(companyId, (v && v.trim()) || d);

    return {
      wipMaterialsAccountId: await pick(
        settings.wipMaterialsAccountCode,
        DEFAULTS.wipMaterialsAccountCode
      ),
      wipLaborOverheadAccountId: await pick(
        settings.wipLaborOverheadAccountCode,
        DEFAULTS.wipLaborOverheadAccountCode
      ),
      rawInventoryAccountId: await pick(
        settings.rawInventoryAccountCode,
        DEFAULTS.rawInventoryAccountCode
      ),
      finishedGoodsAccountId: await pick(
        settings.finishedGoodsAccountCode,
        DEFAULTS.finishedGoodsAccountCode
      ),
      overheadAbsorptionAccountId: await pick(
        settings.overheadAbsorptionAccountCode,
        DEFAULTS.overheadAbsorptionAccountCode
      ),
    };
  }
}

export const manufacturingAccountResolverService =
  new ManufacturingAccountResolverService();
