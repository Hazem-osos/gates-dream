import type { LegacySourceAdapter } from '../types';
import type { MigrationIssueService } from './migration-issue.service';

export type AccountResolutionClass =
  | 'MASTER_ACCOUNT_MATCH'
  | 'DERIVED_HIERARCHY_MATCH'
  | 'DETERMINISTIC_GENERATABLE'
  | 'AMBIGUOUS'
  | 'BLOCKED';

export interface AccountResolutionRow {
  accountNo: string;
  classification: AccountResolutionClass;
  masterAccountCode?: string;
  reason: string;
}

export interface AccountResolutionReport {
  masterMatch: number;
  derived: number;
  generatable: number;
  ambiguous: number;
  blocked: number;
  rows: AccountResolutionRow[];
}

export class AccountResolverService {
  constructor(
    private readonly adapter: LegacySourceAdapter,
    private readonly issues: MigrationIssueService
  ) {}

  async analyzeGlOnlyCodes(jobId: string, legacyCompanyCode: string): Promise<AccountResolutionReport> {
    const poolRows = await this.adapter.querySql<{ accountNo: string }>(
      `SELECT DISTINCT RTRIM(d.AccountNo) AS accountNo
       FROM dbo.GLTrxDetail d
       WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(ISNULL(d.AccountNo,''))<>''
         AND NOT EXISTS (
           SELECT 1 FROM dbo.Account a
           WHERE a.CompanyCode=d.CompanyCode AND RTRIM(a.AccountCode)=RTRIM(d.AccountNo)
         )`,
      { cc: legacyCompanyCode }
    );

    const masters = await this.adapter.querySql<{
      AccountCode: string;
      ParentAccount: string;
      FullPath: string;
    }>(
      `SELECT RTRIM(AccountCode) AS AccountCode, RTRIM(ISNULL(ParentAccount,'')) AS ParentAccount,
              RTRIM(ISNULL(FullPath,'')) AS FullPath
       FROM dbo.Account WHERE RTRIM(CompanyCode)=@cc`,
      { cc: legacyCompanyCode }
    );
    const masterSet = new Set(masters.map((m) => m.AccountCode.trim()));
    const byParent = new Map(masters.map((m) => [m.AccountCode.trim(), m]));

    const rows: AccountResolutionRow[] = [];
    for (const { accountNo } of poolRows) {
      const code = accountNo.trim();
      let classification: AccountResolutionClass = 'BLOCKED';
      let masterAccountCode: string | undefined;
      let reason = 'No master row';

      if (masterSet.has(code)) {
        classification = 'MASTER_ACCOUNT_MATCH';
        reason = 'Exact master match';
      } else {
        const parent = this.findLongestPrefixParent(code, byParent);
        if (parent) {
          classification = 'DERIVED_HIERARCHY_MATCH';
          masterAccountCode = parent;
          reason = `Prefix matches parent account ${parent}`;
        } else if (/^\d+$/.test(code) && code.length <= 20) {
          classification = 'DETERMINISTIC_GENERATABLE';
          reason = 'Numeric code — generate leaf under inferred hierarchy (no suspense)';
        } else {
          classification = 'AMBIGUOUS';
          reason = 'Cannot derive parent safely';
        }
      }

      rows.push({ accountNo: code, classification, masterAccountCode, reason });
      if (classification === 'AMBIGUOUS') {
        await this.issues.record({
          jobId,
          stage: 'ACCOUNTING',
          severity: 'WARNING',
          category: 'AMBIGUOUS_MAPPING',
          sourceEntity: 'GLTrxDetail.AccountNo',
          sourceKey: code,
          description: reason,
        });
      }
    }

    const generatableDetails = rows
      .filter((r) => r.classification === 'DETERMINISTIC_GENERATABLE')
      .map((r) => ({
        accountNo: r.accountNo,
        evidence: 'Numeric GL account code present on posted lines but absent from Account master',
        inferredParent: r.masterAccountCode ?? '(leaf under longest matching COA prefix if any)',
        inferredNature: 'unknown until Phase 2 COA policy — not inferred from suspense',
        deterministicBecause:
          'Code is numeric (≤20 digits); hierarchy parent can be resolved from prefix rules without guessing semantics',
        unknownFields: ['arabicName', 'englishName', 'accountType', 'posting rules'],
      }));

    const report = {
      masterMatch: rows.filter((r) => r.classification === 'MASTER_ACCOUNT_MATCH').length,
      derived: rows.filter((r) => r.classification === 'DERIVED_HIERARCHY_MATCH').length,
      generatable: rows.filter((r) => r.classification === 'DETERMINISTIC_GENERATABLE').length,
      ambiguous: rows.filter((r) => r.classification === 'AMBIGUOUS').length,
      blocked: rows.filter((r) => r.classification === 'BLOCKED').length,
      generatableDetails,
      rows,
    };
    return report;
  }

  private findLongestPrefixParent(
    code: string,
    byParent: Map<string, { AccountCode: string; ParentAccount: string; FullPath: string }>
  ): string | null {
    let best: string | null = null;
    for (const master of byParent.keys()) {
      if (code.startsWith(master) && master.length > (best?.length ?? 0)) {
        best = master;
      }
    }
    return best;
  }
}
