import prisma from '../../../shared/database/prisma';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { SYSTEM_GL_CODES } from '../../accounting/data/system-account-map';
import { companySettingService } from '../../platform/services/company-setting.service';

// M16 fix: these previously hardcoded a parallel set of GL codes that didn't
// match the actual provisioned chart of accounts (coa-template.data.ts) —
// e.g. inputVatAccountCode '1241' and whtAssetAccountCode '1142' referred to
// accounts that either didn't exist (breaking every contracting posting for
// any company that hadn't manually configured contractingSettings) or, worse,
// silently collided with an unrelated account ('1142' = Raw Materials
// Inventory), which would have posted WHT-asset amounts straight into
// inventory. Deriving from the same SYSTEM_GL_CODES map used by tenant
// provisioning keeps these in sync by construction.
const DEFAULTS = {
  contractingRevenueAccountCode: SYSTEM_GL_CODES.contractRevenue,
  projectExpenseAccountCode: SYSTEM_GL_CODES.subcontractorCost,
  clientReceivableAccountCode: SYSTEM_GL_CODES.ar,
  subcontractorPayableAccountCode: SYSTEM_GL_CODES.ap,
  customerAdvanceAccountCode: SYSTEM_GL_CODES.customerAdvance,
  subcontractorAdvanceAccountCode: SYSTEM_GL_CODES.subcontractorAdvance,
  retentionHeldByOthersAccountCode: SYSTEM_GL_CODES.retentionReceivable,
  retentionWithheldForOthersAccountCode: SYSTEM_GL_CODES.retentionPayable,
  outputVatAccountCode: SYSTEM_GL_CODES.vatOutput,
  inputVatAccountCode: SYSTEM_GL_CODES.vatInput,
  whtAssetAccountCode: SYSTEM_GL_CODES.whtReceivable,
  whtPayableAccountCode: SYSTEM_GL_CODES.whtPayable,
  penaltiesExpenseAccountCode: SYSTEM_GL_CODES.contractPenalty,
  materialsOnSiteAccountCode: SYSTEM_GL_CODES.inventory,
  engineeringStampsExpenseAccountCode: SYSTEM_GL_CODES.bankFees,
};

export class ContractingAccountResolverService {
  async getSettings(companyId: string) {
    return prisma.contractingSettings.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  async resolveAccounts(companyId: string) {
    const settings = await this.getSettings(companyId);
    const pick = (code: string | null | undefined, fallback: string) =>
      invoiceAccountResolverService.resolveAccountId(
        companyId,
        (code && code.trim()) || fallback
      );

    return {
      settings,
      contractingRevenueAccountId: await pick(
        settings.contractingRevenueAccountCode,
        DEFAULTS.contractingRevenueAccountCode
      ),
      projectExpenseAccountId: await pick(
        settings.projectExpenseAccountCode,
        DEFAULTS.projectExpenseAccountCode
      ),
      clientReceivableAccountId: await pick(
        settings.clientReceivableAccountCode,
        DEFAULTS.clientReceivableAccountCode
      ),
      subcontractorPayableAccountId: await pick(
        settings.subcontractorPayableAccountCode,
        DEFAULTS.subcontractorPayableAccountCode
      ),
      customerAdvanceAccountId: await pick(
        settings.customerAdvanceAccountCode,
        DEFAULTS.customerAdvanceAccountCode
      ),
      subcontractorAdvanceAccountId: await pick(
        settings.subcontractorAdvanceAccountCode,
        DEFAULTS.subcontractorAdvanceAccountCode
      ),
      retentionHeldByOthersAccountId: await pick(
        settings.retentionHeldByOthersAccountCode,
        DEFAULTS.retentionHeldByOthersAccountCode
      ),
      retentionWithheldForOthersAccountId: await pick(
        settings.retentionWithheldForOthersAccountCode,
        DEFAULTS.retentionWithheldForOthersAccountCode
      ),
      outputVatAccountId: await pick(
        settings.outputVatAccountCode,
        DEFAULTS.outputVatAccountCode
      ),
      whtAssetAccountId: await pick(
        settings.whtAssetAccountCode,
        DEFAULTS.whtAssetAccountCode
      ),
      whtPayableAccountId: await pick(
        settings.whtPayableAccountCode,
        DEFAULTS.whtPayableAccountCode
      ),
      inputVatAccountId: await pick(
        settings.inputVatAccountCode,
        DEFAULTS.inputVatAccountCode
      ),
      penaltiesExpenseAccountId: await pick(
        settings.penaltiesExpenseAccountCode,
        DEFAULTS.penaltiesExpenseAccountCode
      ),
      materialsOnSiteAccountId: await this.resolveSettingOrFallback(
        companyId,
        'ClientMaterialsOnSiteAccount',
        DEFAULTS.materialsOnSiteAccountCode
      ),
      engineeringStampsExpenseAccountId: await this.resolveSettingOrFallback(
        companyId,
        'EngineeringStampsExpenseAccount',
        DEFAULTS.engineeringStampsExpenseAccountCode
      ),
    };
  }

  private async resolveSettingOrFallback(companyId: string, settingKey: string, fallback: string) {
    const configured = await companySettingService.getEntry(companyId, settingKey);
    return invoiceAccountResolverService.resolveAccountId(
      companyId,
      (configured && configured.trim()) || fallback
    );
  }
}

export const contractingAccountResolverService =
  new ContractingAccountResolverService();
