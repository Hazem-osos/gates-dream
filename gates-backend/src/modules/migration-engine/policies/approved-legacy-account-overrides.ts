export type LegacyAccountOverrideDecisionType = 'SOURCE_DATA_ERROR_CORRECTION' | 'OWNER_MAPPING';

export interface LegacyAccountOverrideRecord {
  id: string;
  targetCompanyId: string;
  sourceCompanyCode: string;
  legacyAccountCode: string;
  targetLegacyAccountCode: string;
  targetAccountId: string | null;
  decisionType: string;
  mappingClassification: string;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  evidenceReference: string;
}

export interface ApprovedLegacyAccountOverrideSeed {
  sourceCompanyCode: string;
  legacyAccountCode: string;
  targetLegacyAccountCode: string;
  decisionType: LegacyAccountOverrideDecisionType;
  mappingClassification: 'OWNER_APPROVED_MAPPING';
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  evidenceReference: string;
}

/** Registered owner decisions — not inferred by the classifier. */
export const OWNER_APPROVED_LEGACY_ACCOUNT_OVERRIDES: ApprovedLegacyAccountOverrideSeed[] = [
  {
    sourceCompanyCode: '0001',
    legacyAccountCode: '102060101003',
    targetLegacyAccountCode: '1020101001',
    decisionType: 'SOURCE_DATA_ERROR_CORRECTION',
    mappingClassification: 'OWNER_APPROVED_MAPPING',
    reason:
      'Legacy forensic evidence: mis-coded POS cash/safe drawer leg in GL 00000084 and 00000085; peer SV99/SR99 journals use 1020101001 on the same journal line.',
    approvedBy: 'owner',
    approvedAt: new Date('2026-10-04T00:00:00.000Z'),
    evidenceReference: 'docs/migration/PHASE36_AMBIGUOUS_ACCOUNT_REPORT.md',
  },
];

export function isOwnerApprovedOverrideRow(
  row: Pick<LegacyAccountOverrideRecord, 'mappingClassification'>
): boolean {
  return row.mappingClassification === 'OWNER_APPROVED_MAPPING';
}
