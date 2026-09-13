import { AppError } from '../../../shared/middleware/error-handler';
import {
  ACCOUNT_SLOT_ALIASES,
  TAX_ACCOUNT_SLOT_ALIASES,
  applyAccountSlot,
  collectFacadeAccountIds,
  collectTaxAccountIds,
  overlayColumnAccountIds,
  type AccountDefs,
  type AccountRef,
} from './account-definition-map';
import type { UpdateAccountingSettingsInput } from './accounting-settings.schema';
import type {
  AccountingSettingsActor,
  AccountingSettingsFacade,
} from './accounting-settings.types';

export type CompanySettingsRow = {
  companyId: string;
  accountDefinitions: unknown;
  advancedSettings: unknown;
  fiscalYearStart: string | null;
  fiscalYearEnd: string | null;
  defaultCurrency: string | null;
  journalEntryDigits: number | null;
  decimalsInAmounts: number | null;
  accountsGuideDigits: number | null;
  costCentersGuideDigits: number | null;
  storesGuideDigits: number | null;
  itemsGuideDigits: number | null;
  dateUsage: string | null;
  operationsFromDate: string | null;
  dueSecuritiesWarningDays: number | null;
  lockPostingBeforeDate: string | null;
  autoNumbering: boolean | null;
  costMethod: string | null;
  pricingCalculationBasis: string | null;
  backupPath: string | null;
  theme: string | null;
  temporaryReceipts: boolean | null;
  documentaryCredits: boolean | null;
  executiveWhatsAppPhone: string | null;
  autoPostGl: boolean;
  retainedEarningsAccountId: string | null;
  enableApprovalsWorkflow: boolean | null;
  allowNegativeBalance: boolean | null;
  allowCostCenterWithoutAccount: boolean | null;
  preventNegativeStock: boolean;
  preventCashOverdraft: boolean;
  preventSellingBelowCost: boolean;
  enforceCostCenterForPnl: boolean;
  roundingAccountId: string | null;
  exchangeGainLossAccountId: string | null;
  budgetAllowExceed: boolean | null;
  budgetWarnHalf: boolean | null;
  budgetWarnSame: boolean | null;
  budgetWarnExceed: boolean | null;
  budgetStopMessageOnly: boolean | null;
  budgetStopLedger: boolean | null;
  budgetStopOrigin: boolean | null;
  budgetStopBoth: boolean | null;
};

export type ContractingSettingsRow = {
  contractingRevenueAccountCode: string | null;
  projectExpenseAccountCode: string | null;
  clientReceivableAccountCode: string | null;
  subcontractorPayableAccountCode: string | null;
  customerAdvanceAccountCode: string | null;
  subcontractorAdvanceAccountCode: string | null;
  retentionHeldByOthersAccountCode: string | null;
  retentionWithheldForOthersAccountCode: string | null;
  penaltiesExpenseAccountCode: string | null;
  outputVatAccountCode: string | null;
  inputVatAccountCode: string | null;
  whtAssetAccountCode: string | null;
  whtPayableAccountCode: string | null;
  defaultVatRate: { toString(): string } | number;
  defaultWhtRate: { toString(): string } | number;
};

export type AccountingSettingsDb = {
  $transaction: <T>(fn: (tx: AccountingSettingsDb) => Promise<T>) => Promise<T>;
  companySettings: {
    findUnique: (args: { where: { companyId: string } }) => Promise<CompanySettingsRow | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<CompanySettingsRow>;
    update: (args: {
      where: { companyId: string };
      data: Record<string, unknown>;
    }) => Promise<CompanySettingsRow>;
  };
  contractingSettings: {
    findUnique: (args: { where: { companyId: string } }) => Promise<ContractingSettingsRow | null>;
    upsert: (args: {
      where: { companyId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  account: {
    findMany: (args: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) => Promise<
      Array<{
        id: string;
        companyId?: string;
        code: string;
        arabicName: string;
        _count?: { children: number };
      }>
    >;
  };
};

type DbClient = AccountingSettingsDb;

type AdvancedSettings = {
  accountingTax?: {
    defaultVatRate?: number;
    whtRate?: number;
    whtThreshold?: number | null;
    applyWithholding?: boolean;
  };
  statementLayouts?: {
    incomeStatementSettings?: unknown;
    financialPositionSettings?: unknown;
  };
  defaultPaymentTermsDays?: number | null;
  [key: string]: unknown;
};

export type AccountingSettingsPorts = {
  db: AccountingSettingsDb;
  recordTrace: (params: {
    companyId: string;
    branchId?: string | null;
    userId: string;
    screenName: string;
    action: 'Edit';
    recordCode: string;
    name: string;
  }) => Promise<void>;
  onUpdated?: (companyId: string) => Promise<void>;
};

function asAccountDefs(value: unknown): AccountDefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const defs: AccountDefs = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.trim()) defs[key] = raw.trim();
  }
  return defs;
}

function asAdvancedSettings(value: unknown): AdvancedSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as AdvancedSettings) };
}

function collectSubmittedAccountIds(input: UpdateAccountingSettingsInput): string[] {
  const ids = new Set<string>();
  const take = (value: string | null | undefined) => {
    if (typeof value === 'string' && value.trim()) ids.add(value.trim());
  };
  take(input.general?.retainedEarningsAccountId);
  if (input.accounts) {
    for (const value of Object.values(input.accounts)) take(value);
  }
  if (input.tax) {
    take(input.tax.salesTaxAccountId);
    take(input.tax.vatInputAccountId);
    take(input.tax.whtPayableAccountId);
    take(input.tax.whtReceivableAccountId);
  }
  return [...ids];
}

export class AccountingSettingsService {
  constructor(private readonly ports: AccountingSettingsPorts) {}

  async getSettings(companyId: string): Promise<AccountingSettingsFacade> {
    const [settings, contracting] = await Promise.all([
      this.ensureCompanySettings(this.ports.db, companyId),
      this.ports.db.contractingSettings.findUnique({ where: { companyId } }),
    ]);

    const defs = overlayColumnAccountIds(asAccountDefs(settings.accountDefinitions), {
      roundingAccountId: settings.roundingAccountId,
      exchangeGainLossAccountId: settings.exchangeGainLossAccountId,
      retainedEarningsAccountId: settings.retainedEarningsAccountId,
    });
    const advanced = asAdvancedSettings(settings.advancedSettings);
    const accounts = collectFacadeAccountIds(defs, {
      roundingAccountId: settings.roundingAccountId,
      exchangeGainLossAccountId: settings.exchangeGainLossAccountId,
      retainedEarningsAccountId: settings.retainedEarningsAccountId,
    });
    const taxAccounts = collectTaxAccountIds(defs);
    const taxMeta = advanced.accountingTax ?? {};
    const layouts = advanced.statementLayouts ?? {};

    const accountIds = [
      ...Object.values(accounts),
      ...Object.values(taxAccounts),
      settings.retainedEarningsAccountId,
    ].filter((id): id is string => Boolean(id));

    const accountDetails = await this.hydrateAccounts(companyId, accountIds);
    accountDetails.retainedEarningsAccountId = settings.retainedEarningsAccountId
      ? accountDetails[settings.retainedEarningsAccountId] ?? null
      : null;

    for (const [key, id] of Object.entries(accounts)) {
      accountDetails[key] = id ? accountDetails[id] ?? null : null;
    }
    for (const [key, id] of Object.entries(taxAccounts)) {
      accountDetails[key] = id ? accountDetails[id] ?? null : null;
    }

    return {
      general: {
        fiscalYearStart: settings.fiscalYearStart,
        fiscalYearEnd: settings.fiscalYearEnd,
        defaultCurrency: settings.defaultCurrency,
        journalEntryDigits: settings.journalEntryDigits ?? 6,
        decimalsInAmounts: settings.decimalsInAmounts ?? 2,
        accountsGuideDigits: settings.accountsGuideDigits,
        costCentersGuideDigits: settings.costCentersGuideDigits,
        storesGuideDigits: settings.storesGuideDigits,
        itemsGuideDigits: settings.itemsGuideDigits,
        dateUsage: settings.dateUsage,
        operationsFromDate: settings.operationsFromDate,
        dueSecuritiesWarningDays: settings.dueSecuritiesWarningDays,
        lockPostingBeforeDate: settings.lockPostingBeforeDate,
        autoNumbering: settings.autoNumbering ?? true,
        costMethod: settings.costMethod,
        pricingCalculationBasis: settings.pricingCalculationBasis ?? 'SELECTED_UNIT_QTY',
        backupPath: settings.backupPath,
        theme: settings.theme,
        temporaryReceipts: settings.temporaryReceipts ?? false,
        documentaryCredits: settings.documentaryCredits ?? false,
        executiveWhatsAppPhone: settings.executiveWhatsAppPhone,
        autoPostGl: settings.autoPostGl,
        retainedEarningsAccountId: settings.retainedEarningsAccountId,
      },
      controls: {
        enableApprovalsWorkflow: settings.enableApprovalsWorkflow ?? true,
        allowNegativeBalance: settings.allowNegativeBalance ?? false,
        preventNegativeStock: settings.preventNegativeStock,
        preventCashOverdraft: settings.preventCashOverdraft,
        noSellBelowCost: settings.preventSellingBelowCost,
        requireCostCenterForExpenses: settings.enforceCostCenterForPnl,
        allowCostCenterWithoutAccount: settings.allowCostCenterWithoutAccount ?? false,
        defaultPaymentTermsDays: advanced.defaultPaymentTermsDays ?? null,
        budgetAllowExceed: settings.budgetAllowExceed ?? false,
        budgetWarnHalf: settings.budgetWarnHalf ?? false,
        budgetWarnSame: settings.budgetWarnSame ?? false,
        budgetWarnExceed: settings.budgetWarnExceed ?? false,
        budgetStopMessageOnly: settings.budgetStopMessageOnly ?? false,
        budgetStopLedger: settings.budgetStopLedger ?? false,
        budgetStopOrigin: settings.budgetStopOrigin ?? false,
        budgetStopBoth: settings.budgetStopBoth ?? false,
      },
      tax: {
        defaultVatRate: taxMeta.defaultVatRate ?? Number(contracting?.defaultVatRate ?? 0.14),
        whtRate: taxMeta.whtRate ?? Number(contracting?.defaultWhtRate ?? 0.01),
        whtThreshold: taxMeta.whtThreshold ?? null,
        applyWithholding: taxMeta.applyWithholding ?? false,
        ...taxAccounts,
      },
      accounts,
      contracting: {
        contractingRevenueAccountCode: contracting?.contractingRevenueAccountCode ?? null,
        projectExpenseAccountCode: contracting?.projectExpenseAccountCode ?? null,
        clientReceivableAccountCode: contracting?.clientReceivableAccountCode ?? null,
        subcontractorPayableAccountCode: contracting?.subcontractorPayableAccountCode ?? null,
        customerAdvanceAccountCode: contracting?.customerAdvanceAccountCode ?? null,
        subcontractorAdvanceAccountCode: contracting?.subcontractorAdvanceAccountCode ?? null,
        retentionHeldByOthersAccountCode: contracting?.retentionHeldByOthersAccountCode ?? null,
        retentionWithheldForOthersAccountCode:
          contracting?.retentionWithheldForOthersAccountCode ?? null,
        penaltiesExpenseAccountCode: contracting?.penaltiesExpenseAccountCode ?? null,
        outputVatAccountCode: contracting?.outputVatAccountCode ?? null,
        inputVatAccountCode: contracting?.inputVatAccountCode ?? null,
        whtAssetAccountCode: contracting?.whtAssetAccountCode ?? null,
        whtPayableAccountCode: contracting?.whtPayableAccountCode ?? null,
        defaultVatRate: Number(contracting?.defaultVatRate ?? 0.14),
        defaultWhtRate: Number(contracting?.defaultWhtRate ?? 0.01),
      },
      statementLayouts: {
        incomeStatementSettings: layouts.incomeStatementSettings ?? null,
        financialPositionSettings: layouts.financialPositionSettings ?? null,
      },
      accountDetails,
    };
  }

  async updateSettings(
    actor: AccountingSettingsActor,
    input: UpdateAccountingSettingsInput
  ): Promise<AccountingSettingsFacade> {
    await this.assertPostableLeafAccounts(actor.companyId, collectSubmittedAccountIds(input));

    await this.ports.db.$transaction(async (tx) => {
      const current = await this.ensureCompanySettings(tx, actor.companyId);
      const defs = asAccountDefs(current.accountDefinitions);
      const advanced = asAdvancedSettings(current.advancedSettings);

      if (input.accounts) {
        for (const [key, aliases] of Object.entries(ACCOUNT_SLOT_ALIASES)) {
          applyAccountSlot(
            defs,
            aliases,
            input.accounts[key as keyof typeof input.accounts]
          );
        }
      }
      if (input.tax) {
        for (const [key, aliases] of Object.entries(TAX_ACCOUNT_SLOT_ALIASES)) {
          applyAccountSlot(defs, aliases, input.tax[key as keyof typeof input.tax] as string | null | undefined);
        }
        advanced.accountingTax = {
          ...(advanced.accountingTax ?? {}),
          ...(input.tax.defaultVatRate !== undefined
            ? { defaultVatRate: input.tax.defaultVatRate }
            : {}),
          ...(input.tax.whtRate !== undefined ? { whtRate: input.tax.whtRate } : {}),
          ...(input.tax.whtThreshold !== undefined
            ? { whtThreshold: input.tax.whtThreshold }
            : {}),
          ...(input.tax.applyWithholding !== undefined
            ? { applyWithholding: input.tax.applyWithholding }
            : {}),
        };
      }
      if (input.statementLayouts) {
        advanced.statementLayouts = {
          ...(advanced.statementLayouts ?? {}),
          ...(input.statementLayouts.incomeStatementSettings !== undefined
            ? { incomeStatementSettings: input.statementLayouts.incomeStatementSettings }
            : {}),
          ...(input.statementLayouts.financialPositionSettings !== undefined
            ? { financialPositionSettings: input.statementLayouts.financialPositionSettings }
            : {}),
        };
      }
      if (input.controls?.defaultPaymentTermsDays !== undefined) {
        advanced.defaultPaymentTermsDays = input.controls.defaultPaymentTermsDays;
      }

      const preventNegativeStock =
        input.controls?.preventNegativeStock ?? current.preventNegativeStock;
      const allowNegativeBalance =
        input.controls?.allowNegativeBalance ??
        (input.controls?.preventNegativeStock === undefined
          ? current.allowNegativeBalance
          : !input.controls.preventNegativeStock);
      const preventSellingBelowCost =
        input.controls?.preventSellingBelowCost ??
        input.controls?.noSellBelowCost ??
        current.preventSellingBelowCost;
      const enforceCostCenterForPnl =
        input.controls?.enforceCostCenterForPnl ??
        input.controls?.requireCostCenterForExpenses ??
        current.enforceCostCenterForPnl;

      const roundingAccountId =
        input.accounts?.roundingDifferenceAccountId !== undefined
          ? input.accounts.roundingDifferenceAccountId
          : current.roundingAccountId;
      const exchangeGainLossAccountId =
        input.accounts?.exchangeGainLossAccountId !== undefined
          ? input.accounts.exchangeGainLossAccountId
          : current.exchangeGainLossAccountId;
      const retainedEarningsAccountId =
        input.general?.retainedEarningsAccountId !== undefined
          ? input.general.retainedEarningsAccountId
          : current.retainedEarningsAccountId;

      await tx.companySettings.update({
        where: { companyId: actor.companyId },
        data: {
          fiscalYearStart: input.general?.fiscalYearStart ?? current.fiscalYearStart,
          fiscalYearEnd: input.general?.fiscalYearEnd ?? current.fiscalYearEnd,
          defaultCurrency: input.general?.defaultCurrency ?? current.defaultCurrency,
          journalEntryDigits: input.general?.journalEntryDigits ?? current.journalEntryDigits,
          decimalsInAmounts: input.general?.decimalsInAmounts ?? current.decimalsInAmounts,
          accountsGuideDigits: input.general?.accountsGuideDigits ?? current.accountsGuideDigits,
          costCentersGuideDigits:
            input.general?.costCentersGuideDigits ?? current.costCentersGuideDigits,
          storesGuideDigits: input.general?.storesGuideDigits ?? current.storesGuideDigits,
          itemsGuideDigits: input.general?.itemsGuideDigits ?? current.itemsGuideDigits,
          dateUsage: input.general?.dateUsage ?? current.dateUsage,
          operationsFromDate: input.general?.operationsFromDate ?? current.operationsFromDate,
          dueSecuritiesWarningDays:
            input.general?.dueSecuritiesWarningDays ?? current.dueSecuritiesWarningDays,
          lockPostingBeforeDate:
            input.general?.lockPostingBeforeDate ?? current.lockPostingBeforeDate,
          autoNumbering: input.general?.autoNumbering ?? current.autoNumbering,
          costMethod: input.general?.costMethod ?? current.costMethod,
          pricingCalculationBasis:
            input.general?.pricingCalculationBasis ?? current.pricingCalculationBasis,
          backupPath: input.general?.backupPath ?? current.backupPath,
          theme: input.general?.theme ?? current.theme,
          temporaryReceipts: input.general?.temporaryReceipts ?? current.temporaryReceipts,
          documentaryCredits: input.general?.documentaryCredits ?? current.documentaryCredits,
          executiveWhatsAppPhone:
            input.general?.executiveWhatsAppPhone ?? current.executiveWhatsAppPhone,
          autoPostGl: input.general?.autoPostGl ?? current.autoPostGl,
          retainedEarningsAccountId,
          enableApprovalsWorkflow:
            input.controls?.enableApprovalsWorkflow ?? current.enableApprovalsWorkflow,
          allowNegativeBalance,
          allowCostCenterWithoutAccount:
            input.controls?.allowCostCenterWithoutAccount ?? current.allowCostCenterWithoutAccount,
          preventNegativeStock,
          preventCashOverdraft:
            input.controls?.preventCashOverdraft ?? current.preventCashOverdraft,
          preventSellingBelowCost,
          enforceCostCenterForPnl,
          roundingAccountId,
          exchangeGainLossAccountId,
          budgetAllowExceed: input.controls?.budgetAllowExceed ?? current.budgetAllowExceed,
          budgetWarnHalf: input.controls?.budgetWarnHalf ?? current.budgetWarnHalf,
          budgetWarnSame: input.controls?.budgetWarnSame ?? current.budgetWarnSame,
          budgetWarnExceed: input.controls?.budgetWarnExceed ?? current.budgetWarnExceed,
          budgetStopMessageOnly:
            input.controls?.budgetStopMessageOnly ?? current.budgetStopMessageOnly,
          budgetStopLedger: input.controls?.budgetStopLedger ?? current.budgetStopLedger,
          budgetStopOrigin: input.controls?.budgetStopOrigin ?? current.budgetStopOrigin,
          budgetStopBoth: input.controls?.budgetStopBoth ?? current.budgetStopBoth,
          accountDefinitions: defs,
          advancedSettings: advanced,
        },
      });

      if (input.contracting) {
        await tx.contractingSettings.upsert({
          where: { companyId: actor.companyId },
          create: {
            companyId: actor.companyId,
            ...this.contractingWrite(input.contracting),
          },
          update: this.contractingWrite(input.contracting),
        });
      }
    });

    await this.ports.recordTrace({
      companyId: actor.companyId,
      branchId: actor.branchId,
      userId: actor.userId,
      screenName: 'mnsmSetting',
      action: 'Edit',
      recordCode: 'accounting-settings',
      name: 'إعدادات المحاسبة',
    });
    await this.ports.onUpdated?.(actor.companyId);
    return this.getSettings(actor.companyId);
  }

  async assertPostableLeafAccounts(companyId: string, accountIds: string[]): Promise<void> {
    const unique = [...new Set(accountIds.filter(Boolean))];
    if (unique.length === 0) return;

    const accounts = await this.ports.db.account.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        code: true,
        arabicName: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));

    for (const accountId of unique) {
      const account = byId.get(accountId);
      if (!account || account.companyId !== companyId) {
        throw new AppError(
          422,
          'Account does not exist in this company or is not available for posting'
        );
      }
      if ((account._count?.children ?? 0) > 0) {
        throw new AppError(
          422,
          `Account ${account.code} (${account.arabicName}) is a header account and cannot be used as a default posting account`
        );
      }
    }
  }

  private async hydrateAccounts(
    companyId: string,
    accountIds: string[]
  ): Promise<Record<string, AccountRef | null>> {
    const unique = [...new Set(accountIds)];
    const details: Record<string, AccountRef | null> = {};
    if (unique.length === 0) return details;

    const rows = await this.ports.db.account.findMany({
      where: { id: { in: unique }, companyId, deletedAt: null },
      select: { id: true, code: true, arabicName: true },
    });
    for (const row of rows) {
      details[row.id] = { id: row.id, code: row.code, arabicName: row.arabicName };
    }
    for (const id of unique) {
      details[id] ??= null;
    }
    return details;
  }

  private async ensureCompanySettings(db: DbClient, companyId: string) {
    const existing = await db.companySettings.findUnique({ where: { companyId } });
    if (existing) return existing;
    return db.companySettings.create({
      data: {
        companyId,
        journalEntryDigits: 6,
        decimalsInAmounts: 2,
        autoNumbering: true,
        autoPostGl: true,
        preventNegativeStock: true,
        preventCashOverdraft: true,
        enforceCostCenterForPnl: false,
        preventSellingBelowCost: false,
      },
    });
  }

  private contractingWrite(input: NonNullable<UpdateAccountingSettingsInput['contracting']>) {
    return {
      contractingRevenueAccountCode: input.contractingRevenueAccountCode ?? undefined,
      projectExpenseAccountCode: input.projectExpenseAccountCode ?? undefined,
      clientReceivableAccountCode: input.clientReceivableAccountCode ?? undefined,
      subcontractorPayableAccountCode: input.subcontractorPayableAccountCode ?? undefined,
      customerAdvanceAccountCode: input.customerAdvanceAccountCode ?? undefined,
      subcontractorAdvanceAccountCode: input.subcontractorAdvanceAccountCode ?? undefined,
      retentionHeldByOthersAccountCode: input.retentionHeldByOthersAccountCode ?? undefined,
      retentionWithheldForOthersAccountCode:
        input.retentionWithheldForOthersAccountCode ?? undefined,
      penaltiesExpenseAccountCode: input.penaltiesExpenseAccountCode ?? undefined,
      outputVatAccountCode: input.outputVatAccountCode ?? undefined,
      inputVatAccountCode: input.inputVatAccountCode ?? undefined,
      whtAssetAccountCode: input.whtAssetAccountCode ?? undefined,
      whtPayableAccountCode: input.whtPayableAccountCode ?? undefined,
      defaultVatRate: input.defaultVatRate,
      defaultWhtRate: input.defaultWhtRate,
    };
  }
}
