import { longestMasterPrefix, normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import {
  MIN_PREFIX_LEN_FOR_DERIVED_LEAF,
  type LegacyAccountMasterRow,
  type LegacyCoaSnapshot,
} from './legacy-coa-data.service';

export type AccountReferenceClassification =
  | 'EXACT_MASTER'
  | 'NORMALIZED_MASTER'
  | 'DERIVED_FROM_LEGACY_STRUCTURE'
  | 'DETERMINISTIC_GENERATABLE'
  | 'GENERATED_STRUCTURAL_PARENT'
  | 'DEPENDENT_ON_FUTURE_PARTY_MIGRATION'
  | 'AMBIGUOUS'
  | 'INVALID_SOURCE'
  | 'BLOCKED';

export interface ClassifiedAccountReference {
  code: string;
  classification: AccountReferenceClassification;
  evidence: string;
  masterAccountCode?: string;
  partySource?: 'Customer' | 'Supplier';
  suggestedArabicName?: string;
  migratableInCoaStage: boolean;
}

export interface AccountClassificationReport {
  byClass: Record<AccountReferenceClassification, number>;
  rows: ClassifiedAccountReference[];
  glOnlyExplanation: {
    totalGlOnlyPosted: number;
    priorEtLClaim70: string;
    forensicPostedGlOnlyCount: number;
  };
}

function masterByCode(masters: LegacyAccountMasterRow[]): Map<string, LegacyAccountMasterRow> {
  return new Map(masters.map((m) => [m.accountCode, m]));
}

export function classifyAccountUniverse(
  snapshot: LegacyCoaSnapshot,
  universe: { glOnlyPosted: string[]; requiredForPostedGl: string[] }
): AccountClassificationReport {
  const masters = masterByCode(snapshot.masters);
  const rows: ClassifiedAccountReference[] = [];

  const codesToClassify = new Set<string>([
    ...snapshot.masters.map((m) => m.accountCode),
    ...snapshot.postedGlCodes,
  ]);

  for (const code of [...codesToClassify].sort()) {
    rows.push(classifyOne(code, snapshot, masters));
  }

  const byClass = emptyClassCounts();
  for (const r of rows) {
    byClass[r.classification] += 1;
  }

  return {
    byClass,
    rows,
    glOnlyExplanation: {
      totalGlOnlyPosted: universe.glOnlyPosted.length,
      priorEtLClaim70:
        'LEGACY_ETL_VS_REAL_DB.md cited ~70 GL codes without master rows when counting all GL detail lines (draft+posted) or other sources; LegacyForensic company 0001 posted GL has only 2 GL-only codes.',
      forensicPostedGlOnlyCount: universe.glOnlyPosted.length,
    },
  };
}

function emptyClassCounts(): Record<AccountReferenceClassification, number> {
  return {
    EXACT_MASTER: 0,
    NORMALIZED_MASTER: 0,
    DERIVED_FROM_LEGACY_STRUCTURE: 0,
    DETERMINISTIC_GENERATABLE: 0,
    GENERATED_STRUCTURAL_PARENT: 0,
    DEPENDENT_ON_FUTURE_PARTY_MIGRATION: 0,
    AMBIGUOUS: 0,
    INVALID_SOURCE: 0,
    BLOCKED: 0,
  };
}

function classifyOne(
  code: string,
  snapshot: LegacyCoaSnapshot,
  masters: Map<string, LegacyAccountMasterRow>
): ClassifiedAccountReference {
  const normalized = normalizeLegacyAccountCode(code);
  if (!normalized) {
    return {
      code,
      classification: 'INVALID_SOURCE',
      evidence: 'Empty account code',
      migratableInCoaStage: false,
    };
  }

  if (snapshot.masterCodes.has(normalized)) {
    const rawMatch = snapshot.masters.some((m) => m.accountCode === normalized);
    return {
      code: normalized,
      classification: rawMatch ? 'EXACT_MASTER' : 'NORMALIZED_MASTER',
      evidence: 'Present in Account master',
      masterAccountCode: normalized,
      migratableInCoaStage: true,
    };
  }

  if (snapshot.partyAccountCodes.has(normalized)) {
    const partySource = snapshot.masters.some((m) => m.accountCode === normalized)
      ? undefined
      : classifyPartySource(normalized, snapshot);
    return {
      code: normalized,
      classification: 'DEPENDENT_ON_FUTURE_PARTY_MIGRATION',
      evidence: 'Code matches Customer/Supplier AccountCode — target posting account created in party migration',
      partySource,
      migratableInCoaStage: false,
    };
  }

  const prefix = longestMasterPrefix(normalized, snapshot.masterCodes);
  if (prefix && prefix !== normalized) {
    const parent = masters.get(prefix);
    const underPartyControl =
      prefix.length >= MIN_PREFIX_LEN_FOR_DERIVED_LEAF &&
      parent &&
      parent.hasChild &&
      parent.accountType === 'C' &&
      snapshot.partyAccountCodes.size > 0 &&
      [...snapshot.partyAccountCodes].some((p) => p.startsWith(prefix));

    if (underPartyControl && !snapshot.glLineHintByCode.has(normalized)) {
      return {
        code: normalized,
        classification: 'DEPENDENT_ON_FUTURE_PARTY_MIGRATION',
        evidence: `GL code extends party control header ${prefix} but is not a registered party AccountCode`,
        masterAccountCode: prefix,
        migratableInCoaStage: false,
      };
    }

    if (prefix.length >= MIN_PREFIX_LEN_FOR_DERIVED_LEAF) {
      const hint = snapshot.glLineHintByCode.get(normalized);
      return {
        code: normalized,
        classification: 'DERIVED_FROM_LEGACY_STRUCTURE',
        evidence: `Posted GL uses code under master prefix ${prefix}${hint ? `; line hint: ${hint}` : ''}`,
        masterAccountCode: prefix,
        suggestedArabicName: hint || `[GL] ${normalized}`,
        migratableInCoaStage: true,
      };
    }
  }

  if (prefix && prefix.length < MIN_PREFIX_LEN_FOR_DERIVED_LEAF) {
    return {
      code: normalized,
      classification: 'AMBIGUOUS',
      evidence: `Only short master prefix "${prefix}" — cannot derive posting account safely`,
      masterAccountCode: prefix,
      migratableInCoaStage: false,
    };
  }

  return {
    code: normalized,
    classification: 'BLOCKED',
    evidence: 'No master row and no safe deterministic parent',
    migratableInCoaStage: false,
  };
}

function classifyPartySource(
  code: string,
  snapshot: LegacyCoaSnapshot
): 'Customer' | 'Supplier' | undefined {
  if ([...snapshot.partyAccountCodes].some((c) => c === code)) {
    if (code.startsWith('202') || code.startsWith('2')) return 'Supplier';
    return 'Customer';
  }
  return undefined;
}

export function accountsToMigrate(classification: AccountClassificationReport): ClassifiedAccountReference[] {
  const codes = new Set<string>();
  const out: ClassifiedAccountReference[] = [];
  for (const row of classification.rows) {
    if (!row.migratableInCoaStage) continue;
    if (row.classification === 'EXACT_MASTER' || row.classification === 'NORMALIZED_MASTER') {
      if (!codes.has(row.code)) {
        codes.add(row.code);
        out.push(row);
      }
    }
  }
  for (const row of classification.rows) {
    if (!row.migratableInCoaStage) continue;
    if (row.classification === 'DERIVED_FROM_LEGACY_STRUCTURE') {
      if (!codes.has(row.code)) {
        codes.add(row.code);
        out.push(row);
      }
    }
  }
  return out;
}
