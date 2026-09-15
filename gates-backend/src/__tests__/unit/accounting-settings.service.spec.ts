import { AppError } from '../../shared/middleware/error-handler';
import {
  AccountingSettingsService,
  type AccountingSettingsDb,
  type CompanySettingsRow,
} from '../../modules/accounting/settings/accounting-settings.service';

const COMPANY_ID = 'company-a';
const OTHER_COMPANY_ID = 'company-b';
const LEAF_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_ID = '33333333-3333-4333-8333-333333333333';

type AccountRow = {
  id: string;
  companyId: string;
  code: string;
  arabicName: string;
  deletedAt: null;
  _count: { children: number };
};

function leaf(id: string, companyId = COMPANY_ID): AccountRow {
  return {
    id,
    companyId,
    code: '411',
    arabicName: 'المبيعات',
    deletedAt: null,
    _count: { children: 0 },
  };
}

function header(id: string): AccountRow {
  return {
    ...leaf(id),
    code: '41',
    arabicName: 'الإيرادات',
    _count: { children: 2 },
  };
}

function createDb(accounts: AccountRow[]): {
  db: AccountingSettingsDb;
  settings: CompanySettingsRow & { accountDefinitions: Record<string, string> };
} {
  const settings: CompanySettingsRow & { accountDefinitions: Record<string, string> } = {
    companyId: COMPANY_ID,
    accountDefinitions: {} as Record<string, string>,
    advancedSettings: {},
    fiscalYearStart: null,
    fiscalYearEnd: null,
    defaultCurrency: 'EGP',
    journalEntryDigits: 6,
    decimalsInAmounts: 2,
    accountsGuideDigits: 1,
    costCentersGuideDigits: 1,
    storesGuideDigits: 1,
    itemsGuideDigits: 1,
    dateUsage: 'gregorian',
    operationsFromDate: null,
    dueSecuritiesWarningDays: 10,
    lockPostingBeforeDate: null,
    autoNumbering: true,
    costMethod: 'average',
    pricingCalculationBasis: 'SELECTED_UNIT_QTY',
    backupPath: null,
    theme: 'light',
    temporaryReceipts: false,
    documentaryCredits: false,
    executiveWhatsAppPhone: null,
    autoPostGl: true,
    retainedEarningsAccountId: null,
    enableApprovalsWorkflow: true,
    allowNegativeBalance: false,
    allowCostCenterWithoutAccount: false,
    preventNegativeStock: true,
    preventCashOverdraft: true,
    preventSellingBelowCost: false,
    enforceCostCenterForPnl: false,
    roundingAccountId: null,
    exchangeGainLossAccountId: null,
    budgetAllowExceed: false,
    budgetWarnHalf: false,
    budgetWarnSame: false,
    budgetWarnExceed: false,
    budgetStopMessageOnly: false,
    budgetStopLedger: false,
    budgetStopOrigin: false,
    budgetStopBoth: false,
  };

  const db: AccountingSettingsDb = {
    companySettings: {
      findUnique: jest.fn(async () => settings),
      create: jest.fn(),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(settings, data);
        return settings;
      }),
    },
    contractingSettings: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(),
    },
    account: {
      count: jest.fn(async ({ where }: { where: { companyId?: string } }) =>
        accounts.filter((account) => !where.companyId || account.companyId === where.companyId)
          .length
      ),
      findMany: jest.fn(
        async ({ where }: { where: { id?: { in: string[] }; companyId?: string } }) => {
          const ids = where.id?.in ?? [];
          return accounts.filter((account) => {
            if (ids.length && !ids.includes(account.id)) return false;
            if (where.companyId && account.companyId !== where.companyId) return false;
            return true;
          });
        }
      ),
    },
    costCenter: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    },
    item: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      delete: jest.fn(),
      update: jest.fn(),
    },
    $transaction: async (fn) => fn(db),
  };

  db.$transaction = jest.fn(db.$transaction);

  return { db, settings };
}

describe('AccountingSettingsService', () => {
  const actor = { companyId: COMPANY_ID, userId: 'user-1', branchId: null };

  it('updates default posting accounts and persists them on accountDefinitions', async () => {
    const { db, settings } = createDb([leaf(LEAF_ID)]);
    const recordTrace = jest.fn().mockResolvedValue(undefined);
    const service = new AccountingSettingsService({
      db,
      recordTrace,
    });

    const result = await service.updateSettings(actor, {
      accounts: { salesAccountId: LEAF_ID },
    });

    expect(db.$transaction).toHaveBeenCalled();
    expect(settings.accountDefinitions.salesAccount).toBe(LEAF_ID);
    expect(settings.accountDefinitions.salesRevenueAccount).toBe(LEAF_ID);
    expect(result.accounts.salesAccountId).toBe(LEAF_ID);
    expect(result.accountDetails.salesAccountId).toEqual({
      id: LEAF_ID,
      code: '411',
      arabicName: 'المبيعات',
    });
    expect(recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        action: 'Edit',
        screenName: 'mnsmSetting',
        recordCode: 'accounting-settings',
      })
    );
  });

  it('rejects assigning a parent/header account as a default posting account', async () => {
    const { db } = createDb([header(PARENT_ID)]);
    const service = new AccountingSettingsService({
      db,
      recordTrace: jest.fn(),
    });

    await expect(
      service.updateSettings(actor, { accounts: { salesAccountId: PARENT_ID } })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('header account'),
    } satisfies Partial<AppError>);

    expect(db.companySettings.update).not.toHaveBeenCalled();
  });

  it('prevents assigning an account that belongs to another company', async () => {
    const { db } = createDb([leaf(FOREIGN_ID, OTHER_COMPANY_ID)]);
    const service = new AccountingSettingsService({
      db,
      recordTrace: jest.fn(),
    });

    await expect(
      service.updateSettings(actor, { accounts: { cashAccountId: FOREIGN_ID } })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('this company'),
    } satisfies Partial<AppError>);

    expect(db.companySettings.update).not.toHaveBeenCalled();
    expect(db.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [FOREIGN_ID] } }),
      })
    );
  });
});
