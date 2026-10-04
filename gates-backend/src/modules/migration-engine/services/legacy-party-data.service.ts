import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import type { LegacySourceAdapter } from '../types';

export interface LegacyCustomerRow {
  customerCode: string;
  branchCode: string;
  arabicName: string;
  englishName: string;
  accountCode: string;
  parentAccountCode: string;
  currencyCode: string;
  customerCase: string;
  customerType: string;
  phone1: string;
  phone2: string;
  mobile: string;
  fax: string;
  email: string;
  site: string;
  address: string;
  street: string;
  city: string;
  tradeNum: string;
  mozana: string;
  personCode: string;
  customerCategoryCode: string;
}

export interface LegacySupplierRow {
  supplierCode: string;
  branchCode: string;
  arabicName: string;
  englishName: string;
  accountCode: string;
  currencyCode: string;
  supplierCase: string;
  phone1: string;
  phone2: string;
  mobile: string;
  fax: string;
  email: string;
  site: string;
  address: string;
  street: string;
  mozana: string;
}

export interface LegacyPartySnapshot {
  customers: LegacyCustomerRow[];
  suppliers: LegacySupplierRow[];
  legacyMasterAccountCodes: Set<string>;
  customerAccountCodes: Set<string>;
  supplierAccountCodes: Set<string>;
}

function trim(v: unknown): string {
  return String(v ?? '').trim();
}

export async function loadLegacyPartySnapshot(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<LegacyPartySnapshot> {
  const customerRows = await adapter.querySql<Record<string, unknown>>(
    `SELECT * FROM dbo.Customer WHERE RTRIM(CompanyCode)=@cc`,
    { cc: legacyCompanyCode }
  );
  const supplierRows = await adapter.querySql<Record<string, unknown>>(
    `SELECT * FROM dbo.Supplier WHERE RTRIM(CompanyCode)=@cc`,
    { cc: legacyCompanyCode }
  );

  const masters = await adapter.querySql<{ AccountCode: string }>(
    `SELECT RTRIM(AccountCode) AS AccountCode FROM dbo.Account WHERE RTRIM(CompanyCode)=@cc`,
    { cc: legacyCompanyCode }
  );
  const legacyMasterAccountCodes = new Set(
    masters.map((m) => normalizeLegacyAccountCode(m.AccountCode)).filter(Boolean)
  );

  const customers: LegacyCustomerRow[] = customerRows.map((r) => ({
    customerCode: trim(r.CustomerCode),
    branchCode: trim(r.BranchCode),
    arabicName: trim(r.CustomerNameA),
    englishName: trim(r.CustomerNameE),
    accountCode: normalizeLegacyAccountCode(r.AccountCode),
    parentAccountCode: normalizeLegacyAccountCode(r.ParentAccountCode),
    currencyCode: trim(r.CurrencyCode),
    customerCase: trim(r.CustomerCase),
    customerType: trim(r.CustomerType),
    phone1: trim(r.Phone1),
    phone2: trim(r.Phone2),
    mobile: trim(r.Mobile),
    fax: trim(r.Fax),
    email: trim(r.Email),
    site: trim(r.Site),
    address: trim(r.Address),
    street: trim(r.Street),
    city: trim(r.City),
    tradeNum: trim(r.TradeNum),
    mozana: trim(r.Mozana),
    personCode: trim(r.PersonCode),
    customerCategoryCode: trim(r.CustomerCategoryCode ?? ''),
  }));

  const suppliers: LegacySupplierRow[] = supplierRows.map((r) => ({
    supplierCode: trim(r.SupplierCode),
    branchCode: trim(r.BranchCode),
    arabicName: trim(r.SupplierNameA),
    englishName: trim(r.SupplierNameE),
    accountCode: normalizeLegacyAccountCode(r.AccountCode),
    currencyCode: trim(r.CurrencyCode),
    supplierCase: trim(r.SupplierCase),
    phone1: trim(r.Phone1),
    phone2: trim(r.Phone2),
    mobile: trim(r.Mobile),
    fax: trim(r.Fax),
    email: trim(r.Email),
    site: trim(r.Site),
    address: trim(r.Address),
    street: trim(r.Street),
    mozana: trim(r.Mozana),
  }));

  return {
    customers,
    suppliers,
    legacyMasterAccountCodes,
    customerAccountCodes: new Set(customers.map((c) => c.accountCode).filter(Boolean)),
    supplierAccountCodes: new Set(suppliers.map((s) => s.accountCode).filter(Boolean)),
  };
}
