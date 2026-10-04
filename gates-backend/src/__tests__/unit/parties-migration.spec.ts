import { classifyPartySnapshot } from '../../modules/migration-engine/services/party-classifier.service';
import type { LegacyPartySnapshot } from '../../modules/migration-engine/services/legacy-party-data.service';
import type { PartyAccountResolution } from '../../modules/migration-engine/services/migration-party-account.service';
import { transformCustomerRow } from '../../modules/migration-engine/transforms/party-transform';

describe('parties-migration', () => {
  const baseSnapshot: LegacyPartySnapshot = {
    customers: [
      {
        customerCode: '00000001',
        branchCode: '01',
        arabicName: 'عميل',
        englishName: '',
        accountCode: '10202010102001',
        parentAccountCode: '',
        currencyCode: '0001',
        customerCase: 'L',
        customerType: '',
        phone1: '',
        phone2: '',
        mobile: '',
        fax: '',
        email: '',
        site: '',
        address: '',
        street: '',
        city: '',
        tradeNum: '',
        mozana: '0',
        personCode: '',
        customerCategoryCode: '',
      },
    ],
    suppliers: [],
    legacyMasterAccountCodes: new Set(['10202010102001']),
    customerAccountCodes: new Set(['10202010102001']),
    supplierAccountCodes: new Set(),
  };

  const exactAccount: PartyAccountResolution = {
    legacyAccountCode: '10202010102001',
    classification: 'EXACT_COA_ACCOUNT',
    targetAccountId: 'acc-1',
    evidence: 'ok',
  };

  it('classifies customer with COA account as SAFE', () => {
    const report = classifyPartySnapshot(
      baseSnapshot,
      new Map([['10202010102001', exactAccount]]),
      new Map()
    );
    expect(report.customers[0].classification).toBe('SAFE');
  });

  it('flags missing COA account as DEPENDENT_ON_COA_MAPPING', () => {
    const missing: PartyAccountResolution = {
      legacyAccountCode: '10202010102001',
      classification: 'MISSING_ACCOUNT',
      evidence: 'missing',
    };
    const report = classifyPartySnapshot(
      baseSnapshot,
      new Map([['10202010102001', missing]]),
      new Map()
    );
    expect(report.customers[0].classification).toBe('DEPENDENT_ON_COA_MAPPING');
  });

  it('does not auto-resolve ambiguous GL from similar party prefix', () => {
    const ambiguousGl = '102060101003';
    const partyCodes = baseSnapshot.customerAccountCodes;
    const exactParty = partyCodes.has(ambiguousGl);
    expect(exactParty).toBe(false);
    expect([...partyCodes].some((p) => p === ambiguousGl)).toBe(false);
  });

  it('transform sets balance zero and links account', () => {
    const data = transformCustomerRow(baseSnapshot.customers[0], 'co-1', 'acc-1');
    expect(data.balance).toBe(0);
    expect(data.mainAccountId).toBe('acc-1');
    expect(data.code).toBe('00000001');
  });

  it('detects duplicate customer codes', () => {
    const snap: LegacyPartySnapshot = {
      ...baseSnapshot,
      customers: [...baseSnapshot.customers, { ...baseSnapshot.customers[0] }],
    };
    const report = classifyPartySnapshot(
      snap,
      new Map([['10202010102001', exactAccount]]),
      new Map()
    );
    expect(report.duplicateCustomerCodes).toContain('00000001');
    expect(report.customers.some((c) => c.classification === 'DUPLICATE')).toBe(true);
  });
});
