import prisma from '../../../shared/database/prisma';
import { companySettingService } from '../../platform/services/company-setting.service';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import {
  overlayColumnAccountIds,
  pickAccountDef,
  type AccountDefs,
} from '../../accounting/settings/account-definition-map';

export const SUBCONTRACT_ACCOUNT_KEYS = {
  wip: 'SubcontractWipAccount',
  advance: 'SubcontractAdvanceAccount',
  retention: 'SubcontractRetentionAccount',
  wht: 'SubcontractWhtAccount',
  social: 'SubcontractSocialInsuranceAccount',
  material: 'SubcontractMaterialOveruseAccount',
  penalty: 'SubcontractPenaltyRevenueAccount',
  earlyPay: 'SubcontractEarlyPayDiscountAccount',
  directExec: 'SubcontractDirectExecutionAccount',
  ap: 'SubcontractApAccount',
} as const;

const FALLBACK_CODES = {
  wip: '1410',
  advance: '1610',
  retention: '2465',
  wht: '2411',
  social: '2412',
  material: '1310',
  penalty: '4210',
  earlyPay: '4220',
  directExec: '1415',
  ap: '2110',
} as const;

export class SubcontractAccountResolverService {
  async resolveAccounts(companyId: string) {
    const [settings, contracting] = await Promise.all([
      prisma.companySettings.findUnique({
        where: { companyId },
        select: {
          accountDefinitions: true,
          roundingAccountId: true,
          exchangeGainLossAccountId: true,
          retainedEarningsAccountId: true,
        },
      }),
      prisma.contractingSettings.findUnique({ where: { companyId } }),
    ]);
    const defs = overlayColumnAccountIds((settings?.accountDefinitions ?? {}) as AccountDefs, {
      roundingAccountId: settings?.roundingAccountId,
      exchangeGainLossAccountId: settings?.exchangeGainLossAccountId,
      retainedEarningsAccountId: settings?.retainedEarningsAccountId,
    });

    const pick = async (settingKey: string, fallback: string, extras: Array<string | null | undefined> = []) => {
      const configured = await companySettingService.getEntry(companyId, settingKey);
      const raw =
        extras.find((value) => typeof value === 'string' && value.trim()) ||
        configured?.trim() ||
        fallback;
      return invoiceAccountResolverService.resolveAccountId(companyId, raw);
    };

    return {
      wipAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.wip, FALLBACK_CODES.wip),
      advanceAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.advance, FALLBACK_CODES.advance, [
        contracting?.subcontractorAdvanceAccountCode,
        pickAccountDef(defs, ['supplierAdvanceAccount', 'advanceToSuppliersAccount']),
      ]),
      retentionAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.retention, FALLBACK_CODES.retention, [
        contracting?.retentionWithheldForOthersAccountCode,
        pickAccountDef(defs, ['retentionPayableAccount', 'retentionAccount']),
      ]),
      whtAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.wht, FALLBACK_CODES.wht),
      socialAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.social, FALLBACK_CODES.social),
      materialAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.material, FALLBACK_CODES.material),
      penaltyAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.penalty, FALLBACK_CODES.penalty),
      earlyPayAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.earlyPay, FALLBACK_CODES.earlyPay),
      directExecAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.directExec, FALLBACK_CODES.directExec),
      apAccountId: await pick(SUBCONTRACT_ACCOUNT_KEYS.ap, FALLBACK_CODES.ap),
    };
  }
}

export const subcontractAccountResolverService = new SubcontractAccountResolverService();
