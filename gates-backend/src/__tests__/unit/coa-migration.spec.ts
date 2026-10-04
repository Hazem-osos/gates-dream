import {
  longestMasterPrefix,
  normalizeLegacyAccountCode,
} from '../../modules/migration-engine/coa/legacy-account-code';
import { orderMasterAccountsForInsert, CoaHierarchyError } from '../../modules/migration-engine/coa/hierarchy-order';
import { classifyAccountUniverse } from '../../modules/migration-engine/services/account-classifier.service';
import { buildAccountUniverse } from '../../modules/migration-engine/services/account-universe.service';
import type { LegacyCoaSnapshot } from '../../modules/migration-engine/services/legacy-coa-data.service';
import { transformMasterAccount } from '../../modules/migration-engine/transforms/coa-transform';

describe('coa-migration', () => {
  it('preserves leading zeros in normalization', () => {
    expect(normalizeLegacyAccountCode('0101')).toBe('0101');
    expect(normalizeLegacyAccountCode(' 101 ')).toBe('101');
  });

  it('orders parents before children', () => {
    const masters = [
      {
        accountCode: '1',
        parentAccount: '',
        fullPath: '',
        accountLevel: 0,
        arabicName: 'root',
        englishName: '',
        accountStatus: '',
        accountType: 'C',
        reportType: 'I',
        accountSide: 'D',
        currencyCode: '',
        ccType: 'O',
        hasChild: true,
        deleted: false,
      },
      {
        accountCode: '101',
        parentAccount: '1',
        fullPath: '',
        accountLevel: 1,
        arabicName: 'child',
        englishName: '',
        accountStatus: '',
        accountType: 'D',
        reportType: 'I',
        accountSide: 'D',
        currencyCode: '',
        ccType: 'O',
        hasChild: false,
        deleted: false,
      },
    ];
    const order = orderMasterAccountsForInsert(masters);
    expect(order.indexOf('1')).toBeLessThan(order.indexOf('101'));
  });

  it('detects cycles', () => {
    const masters = [
      {
        accountCode: 'A',
        parentAccount: 'B',
        fullPath: '',
        accountLevel: 0,
        arabicName: '',
        englishName: '',
        accountStatus: '',
        accountType: 'C',
        reportType: 'I',
        accountSide: 'D',
        currencyCode: '',
        ccType: 'O',
        hasChild: true,
        deleted: false,
      },
      {
        accountCode: 'B',
        parentAccount: 'A',
        fullPath: '',
        accountLevel: 0,
        arabicName: '',
        englishName: '',
        accountStatus: '',
        accountType: 'C',
        reportType: 'I',
        accountSide: 'D',
        currencyCode: '',
        ccType: 'O',
        hasChild: true,
        deleted: false,
      },
    ];
    expect(() => orderMasterAccountsForInsert(masters)).toThrow(CoaHierarchyError);
  });

  it('classifies GL-only under long prefix as derived', () => {
    const snapshot: LegacyCoaSnapshot = {
      masters: [
        {
          accountCode: '102020101',
          parentAccount: '1020201',
          fullPath: '',
          accountLevel: 3,
          arabicName: 'عملاء',
          englishName: '',
          accountStatus: '',
          accountType: 'C',
          reportType: 'I',
          accountSide: 'D',
          currencyCode: '',
          ccType: 'O',
          hasChild: true,
          deleted: false,
        },
      ],
      masterCodes: new Set(['102020101']),
      postedGlCodes: new Set(['102020101', '102020101001']),
      allGlCodes: new Set(['102020101', '102020101001']),
      balanceAccountCodes: new Set(),
      partyAccountCodes: new Set(['10202010102001']),
      glLineHintByCode: new Map([['102020101001', 'POS line']]),
      postedGlBalances: new Map(),
      postedGlTotals: { debit: '0', credit: '0' },
    };
    const universe = buildAccountUniverse(snapshot);
    const report = classifyAccountUniverse(snapshot, universe);
    const glOnly = report.rows.find((r) => r.code === '102020101001');
    expect(glOnly?.classification).toBe('DERIVED_FROM_LEGACY_STRUCTURE');
  });

  it('maps header vs posting from HasChild', () => {
    const row = {
      accountCode: '101',
      parentAccount: '1',
      fullPath: '',
      accountLevel: 1,
      arabicName: 'x',
      englishName: '',
      accountStatus: '',
      accountType: 'C',
      reportType: 'I',
      accountSide: 'D',
      currencyCode: '',
      ccType: 'W',
      hasChild: true,
      deleted: false,
    };
    const t = transformMasterAccount(row, 'company-1');
    expect(t.accountKind).toBe('HEADER');
    expect(t.requiresCostCenter).toBe(true);
  });

  it('longest master prefix', () => {
    const masters = new Set(['1', '102', '102020101']);
    expect(longestMasterPrefix('102020101001', masters)).toBe('102020101');
  });
});
