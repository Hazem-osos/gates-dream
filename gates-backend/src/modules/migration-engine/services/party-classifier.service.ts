import type { LegacyCustomerRow, LegacyPartySnapshot, LegacySupplierRow } from './legacy-party-data.service';
import type { PartyAccountResolution } from './migration-party-account.service';

export type PartyRecordClassification =
  | 'SAFE'
  | 'DUPLICATE'
  | 'INACTIVE'
  | 'MISSING_REQUIRED_DATA'
  | 'INVALID_ACCOUNT_REFERENCE'
  | 'AMBIGUOUS'
  | 'DEPENDENT_ON_COA_MAPPING';

export interface ClassifiedPartyRow<T> {
  row: T;
  classification: PartyRecordClassification;
  evidence: string;
  accountResolution?: PartyAccountResolution;
}

export interface PartyClassificationReport {
  customers: ClassifiedPartyRow<LegacyCustomerRow>[];
  suppliers: ClassifiedPartyRow<LegacySupplierRow>[];
  duplicateCustomerCodes: string[];
  duplicateSupplierCodes: string[];
  customerSupplierCodeOverlap: string[];
  counts: Record<PartyRecordClassification, number>;
}

export function classifyPartySnapshot(
  snapshot: LegacyPartySnapshot,
  customerAccounts: Map<string, PartyAccountResolution>,
  supplierAccounts: Map<string, PartyAccountResolution>
): PartyClassificationReport {
  const dupCust = findDuplicates(snapshot.customers.map((c) => c.customerCode));
  const dupSup = findDuplicates(snapshot.suppliers.map((s) => s.supplierCode));
  const custCodes = new Set(snapshot.customers.map((c) => c.customerCode));
  const overlap = snapshot.suppliers
    .map((s) => s.supplierCode)
    .filter((code) => custCodes.has(code));

  const customers = snapshot.customers.map((row) =>
    classifyCustomer(row, dupCust, customerAccounts.get(row.accountCode))
  );
  const suppliers = snapshot.suppliers.map((row) =>
    classifySupplier(row, dupSup, supplierAccounts.get(row.accountCode))
  );

  const counts = emptyCounts();
  for (const c of [...customers, ...suppliers]) {
    counts[c.classification] += 1;
  }

  return {
    customers,
    suppliers,
    duplicateCustomerCodes: dupCust,
    duplicateSupplierCodes: dupSup,
    customerSupplierCodeOverlap: overlap,
    counts,
  };
}

function emptyCounts(): Record<PartyRecordClassification, number> {
  return {
    SAFE: 0,
    DUPLICATE: 0,
    INACTIVE: 0,
    MISSING_REQUIRED_DATA: 0,
    INVALID_ACCOUNT_REFERENCE: 0,
    AMBIGUOUS: 0,
    DEPENDENT_ON_COA_MAPPING: 0,
  };
}

function findDuplicates(codes: string[]): string[] {
  const seen = new Map<string, number>();
  for (const c of codes) {
    if (!c) continue;
    seen.set(c, (seen.get(c) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c);
}

function classifyCustomer(
  row: LegacyCustomerRow,
  dupCodes: string[],
  account?: PartyAccountResolution
): ClassifiedPartyRow<LegacyCustomerRow> {
  if (!row.customerCode || !row.arabicName) {
    return {
      row,
      classification: 'MISSING_REQUIRED_DATA',
      evidence: 'CustomerCode and Arabic name are required',
      accountResolution: account,
    };
  }
  if (dupCodes.includes(row.customerCode)) {
    return { row, classification: 'DUPLICATE', evidence: `Duplicate CustomerCode ${row.customerCode}`, accountResolution: account };
  }
  if (row.customerCase && row.customerCase.toUpperCase() !== 'L') {
    return {
      row,
      classification: 'INACTIVE',
      evidence: `CustomerCase=${row.customerCase}`,
      accountResolution: account,
    };
  }
  const acctClass = account?.classification;
  if (!row.accountCode) {
    return {
      row,
      classification: 'INVALID_ACCOUNT_REFERENCE',
      evidence: 'Missing AccountCode',
      accountResolution: account,
    };
  }
  if (!account || acctClass === 'MISSING_ACCOUNT') {
    return {
      row,
      classification: 'DEPENDENT_ON_COA_MAPPING',
      evidence: account?.evidence ?? 'Account not in target COA',
      accountResolution: account,
    };
  }
  if (acctClass === 'SHARED_CONTROL_ACCOUNT' || acctClass === 'AMBIGUOUS_ACCOUNT') {
    return {
      row,
      classification: 'INVALID_ACCOUNT_REFERENCE',
      evidence: account.evidence,
      accountResolution: account,
    };
  }
  if (acctClass === 'EXACT_COA_ACCOUNT' || acctClass === 'DERIVED_SAFE_ACCOUNT') {
    return { row, classification: 'SAFE', evidence: 'Ready to migrate', accountResolution: account };
  }
  return { row, classification: 'AMBIGUOUS', evidence: 'Unresolved account link', accountResolution: account };
}

function classifySupplier(
  row: LegacySupplierRow,
  dupCodes: string[],
  account?: PartyAccountResolution
): ClassifiedPartyRow<LegacySupplierRow> {
  if (!row.supplierCode || !row.arabicName) {
    return {
      row,
      classification: 'MISSING_REQUIRED_DATA',
      evidence: 'SupplierCode and Arabic name are required',
      accountResolution: account,
    };
  }
  if (dupCodes.includes(row.supplierCode)) {
    return {
      row,
      classification: 'DUPLICATE',
      evidence: `Duplicate SupplierCode ${row.supplierCode}`,
      accountResolution: account,
    };
  }
  if (!row.accountCode) {
    return {
      row,
      classification: 'INVALID_ACCOUNT_REFERENCE',
      evidence: 'Missing AccountCode',
      accountResolution: account,
    };
  }
  const acctClass = account?.classification;
  if (!account || acctClass === 'MISSING_ACCOUNT') {
    return {
      row,
      classification: 'DEPENDENT_ON_COA_MAPPING',
      evidence: account?.evidence ?? 'Account not in target COA',
      accountResolution: account,
    };
  }
  if (acctClass === 'SHARED_CONTROL_ACCOUNT' || acctClass === 'AMBIGUOUS_ACCOUNT') {
    return {
      row,
      classification: 'INVALID_ACCOUNT_REFERENCE',
      evidence: account.evidence,
      accountResolution: account,
    };
  }
  if (acctClass === 'EXACT_COA_ACCOUNT' || acctClass === 'DERIVED_SAFE_ACCOUNT') {
    return { row, classification: 'SAFE', evidence: 'Ready to migrate', accountResolution: account };
  }
  return { row, classification: 'AMBIGUOUS', evidence: 'Unresolved account link', accountResolution: account };
}
