import { LEGACY_GL_DETAIL_JOIN, LEGACY_POSTED_GL_HEADER_WHERE } from '../coa/legacy-posted-gl';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import type { LegacySourceAdapter } from '../types';

export interface LegacyAccountMasterRow {
  accountCode: string;
  parentAccount: string;
  fullPath: string;
  accountLevel: number;
  arabicName: string;
  englishName: string;
  accountStatus: string;
  accountType: string;
  reportType: string;
  accountSide: string;
  currencyCode: string;
  ccType: string;
  hasChild: boolean;
  deleted: boolean;
}

export interface LegacyCoaSnapshot {
  masters: LegacyAccountMasterRow[];
  masterCodes: Set<string>;
  postedGlCodes: Set<string>;
  allGlCodes: Set<string>;
  balanceAccountCodes: Set<string>;
  partyAccountCodes: Set<string>;
  glLineHintByCode: Map<string, string>;
  postedGlBalances: Map<string, { debit: string; credit: string }>;
  postedGlTotals: { debit: string; credit: string };
}

const MIN_PREFIX_LEN_FOR_DERIVED_LEAF = 6;

export { MIN_PREFIX_LEN_FOR_DERIVED_LEAF };

export async function loadLegacyCoaSnapshot(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<LegacyCoaSnapshot> {
  const masterRows = await adapter.querySql<Record<string, unknown>>(
    `SELECT RTRIM(AccountCode) AS AccountCode,
            RTRIM(ISNULL(ParentAccount,'')) AS ParentAccount,
            RTRIM(ISNULL(FullPath,'')) AS FullPath,
            AccountLevel,
            RTRIM(ISNULL(AccountNameA,'')) AS AccountNameA,
            RTRIM(ISNULL(AccountNameE,'')) AS AccountNameE,
            RTRIM(ISNULL(AccountStatus,'')) AS AccountStatus,
            RTRIM(ISNULL(AccountType,'')) AS AccountType,
            RTRIM(ISNULL(ReportType,'')) AS ReportType,
            RTRIM(ISNULL(AccountSide,'')) AS AccountSide,
            RTRIM(ISNULL(CurrencyCode,'')) AS CurrencyCode,
            RTRIM(ISNULL(CCType,'')) AS CCType,
            RTRIM(ISNULL(HasChild,'')) AS HasChild,
            RTRIM(ISNULL(Deleted,'')) AS Deleted
     FROM dbo.Account
     WHERE RTRIM(CompanyCode)=@cc`,
    { cc: legacyCompanyCode }
  );

  const masters: LegacyAccountMasterRow[] = masterRows.map((r) => ({
    accountCode: normalizeLegacyAccountCode(r.AccountCode),
    parentAccount: normalizeLegacyAccountCode(r.ParentAccount),
    fullPath: String(r.FullPath ?? ''),
    accountLevel: Number(r.AccountLevel ?? 0),
    arabicName: String(r.AccountNameA ?? ''),
    englishName: String(r.AccountNameE ?? ''),
    accountStatus: String(r.AccountStatus ?? ''),
    accountType: String(r.AccountType ?? ''),
    reportType: String(r.ReportType ?? ''),
    accountSide: String(r.AccountSide ?? ''),
    currencyCode: String(r.CurrencyCode ?? ''),
    ccType: String(r.CCType ?? ''),
    hasChild: String(r.HasChild ?? '').toUpperCase() === 'T',
    deleted: String(r.Deleted ?? '').toUpperCase() === 'T',
  }));

  const masterCodes = new Set(masters.map((m) => m.accountCode));

  const postedGl = await adapter.querySql<{ accountNo: string }>(
    `SELECT DISTINCT RTRIM(d.AccountNo) AS accountNo
     FROM dbo.GLTrxDetail d
     ${LEGACY_GL_DETAIL_JOIN}
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(ISNULL(d.AccountNo,'')) <> ''
       AND ${LEGACY_POSTED_GL_HEADER_WHERE}`,
    { cc: legacyCompanyCode }
  );
  const postedGlCodes = new Set(postedGl.map((r) => normalizeLegacyAccountCode(r.accountNo)).filter(Boolean));

  const allGl = await adapter.querySql<{ accountNo: string }>(
    `SELECT DISTINCT RTRIM(d.AccountNo) AS accountNo
     FROM dbo.GLTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(ISNULL(d.AccountNo,'')) <> ''`,
    { cc: legacyCompanyCode }
  );
  const allGlCodes = new Set(allGl.map((r) => normalizeLegacyAccountCode(r.accountNo)).filter(Boolean));

  const balanceCodes = new Set<string>();
  if (
    (await adapter.querySql<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM sys.tables WHERE name='BalanceAccountsD'`
    ))[0]?.cnt
  ) {
    const bal = await adapter.querySql<Record<string, string>>(
      `SELECT RTRIM(BalanceAccount1) AS a1, RTRIM(BalanceAccount2) AS a2
       FROM dbo.BalanceAccountsD WHERE RTRIM(CompanyCode)=@cc`,
      { cc: legacyCompanyCode }
    );
    for (const row of bal) {
      if (row.a1) balanceCodes.add(normalizeLegacyAccountCode(row.a1));
      if (row.a2) balanceCodes.add(normalizeLegacyAccountCode(row.a2));
    }
  }

  const partyAccountCodes = new Set<string>();
  for (const table of ['Customer', 'Supplier'] as const) {
    const exists = await adapter.querySql<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM sys.tables WHERE name=@t`,
      { t: table }
    );
    if (!(exists[0]?.cnt ?? 0)) continue;
    const rows = await adapter.querySql<{ AccountCode: string }>(
      `SELECT RTRIM(AccountCode) AS AccountCode FROM dbo.[${table}]
       WHERE RTRIM(CompanyCode)=@cc AND RTRIM(ISNULL(AccountCode,''))<>''`,
      { cc: legacyCompanyCode }
    );
    for (const r of rows) {
      partyAccountCodes.add(normalizeLegacyAccountCode(r.AccountCode));
    }
  }

  const glHints = await adapter.querySql<{ accountNo: string; hint: string }>(
    `SELECT RTRIM(d.AccountNo) AS accountNo,
            MAX(CASE WHEN RTRIM(ISNULL(d.DetailDescA,'')) <> ''
                THEN RTRIM(d.DetailDescA) END) AS hint
     FROM dbo.GLTrxDetail d
     ${LEGACY_GL_DETAIL_JOIN}
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(ISNULL(d.AccountNo,'')) <> ''
       AND ${LEGACY_POSTED_GL_HEADER_WHERE}
     GROUP BY RTRIM(d.AccountNo)`,
    { cc: legacyCompanyCode }
  );
  const glLineHintByCode = new Map<string, string>();
  for (const r of glHints) {
    const code = normalizeLegacyAccountCode(r.accountNo);
    const hint = String(r.hint ?? '').trim();
    if (code && hint) glLineHintByCode.set(code, hint);
  }

  const balanceRows = await adapter.querySql<{ accountNo: string; deb: string; cred: string }>(
    `SELECT RTRIM(d.AccountNo) AS accountNo,
            SUM(CAST(d.DebitValue AS DECIMAL(18,4)) * CAST(d.Change AS DECIMAL(18,4))) AS deb,
            SUM(CAST(d.CreditValue AS DECIMAL(18,4)) * CAST(d.Change AS DECIMAL(18,4))) AS cred
     FROM dbo.GLTrxDetail d
     ${LEGACY_GL_DETAIL_JOIN}
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(ISNULL(d.AccountNo,'')) <> ''
       AND ${LEGACY_POSTED_GL_HEADER_WHERE}
     GROUP BY RTRIM(d.AccountNo)`,
    { cc: legacyCompanyCode }
  );
  const postedGlBalances = new Map<string, { debit: string; credit: string }>();
  let totalDeb = 0;
  let totalCred = 0;
  for (const r of balanceRows) {
    const code = normalizeLegacyAccountCode(r.accountNo);
    const deb = Number(r.deb ?? 0);
    const cred = Number(r.cred ?? 0);
    totalDeb += deb;
    totalCred += cred;
    postedGlBalances.set(code, { debit: deb.toFixed(4), credit: cred.toFixed(4) });
  }

  return {
    masters,
    masterCodes,
    postedGlCodes,
    allGlCodes,
    balanceAccountCodes: balanceCodes,
    partyAccountCodes,
    glLineHintByCode,
    postedGlBalances,
    postedGlTotals: { debit: totalDeb.toFixed(2), credit: totalCred.toFixed(2) },
  };
}
