import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import { loadLegacyCoaSnapshot } from './legacy-coa-data.service';
import { loadLegacyPartySnapshot } from './legacy-party-data.service';
import type { MigrationContext } from '../migration-context';
import { reconcileCoa } from '../stages/coa.stage';

const FORENSIC_AMBIGUOUS_GL = '102060101003';

export interface GlCodePartyEvidence {
  code: string;
  partyLinked: boolean;
  classification:
    | 'STILL_AMBIGUOUS'
    | 'PARTY_EVIDENCE_FOUND'
    | 'RESOLVED_BY_COA'
    | 'RESOLVED_BY_OWNER_OVERRIDE';
  evidence: string;
}

export async function evaluateAmbiguousPostedGlWithPartyData(
  ctx: MigrationContext
): Promise<{ rows: GlCodePartyEvidence[]; coaReconcile: Awaited<ReturnType<typeof reconcileCoa>> }> {
  const parties = await loadLegacyPartySnapshot(ctx.source, ctx.legacyCompanyCode);
  const coaReconcile = await reconcileCoa(ctx);

  const partyAccounts = new Set([
    ...parties.customerAccountCodes,
    ...parties.supplierAccountCodes,
  ]);

  const rows: GlCodePartyEvidence[] = [];
  for (const row of coaReconcile.glReadiness) {
    if (row.status !== 'AMBIGUOUS' && row.code !== FORENSIC_AMBIGUOUS_GL) continue;
    if (row.code !== FORENSIC_AMBIGUOUS_GL) {
      rows.push({
        code: row.code,
        partyLinked: partyAccounts.has(row.code),
        classification: 'STILL_AMBIGUOUS',
        evidence: row.reason,
      });
      continue;
    }

    const exactParty = partyAccounts.has(FORENSIC_AMBIGUOUS_GL);
    const prefixParty = [...partyAccounts].some(
      (p) => p.startsWith(FORENSIC_AMBIGUOUS_GL) || FORENSIC_AMBIGUOUS_GL.startsWith(p)
    );
    const master = parties.legacyMasterAccountCodes.has(FORENSIC_AMBIGUOUS_GL);

    let evidence = 'No Customer/Supplier AccountCode equals 102060101003. ';
    evidence += `Party account codes are 14-digit analytical leaves under 102020101* / 202010101001. `;
    evidence += `Posted GL POS lines (SV99/SR99) use this code; no party master row. `;
    if (exactParty) evidence += 'Exact party match (unexpected). ';
    if (prefixParty) evidence += 'Prefix overlap with party codes only at short prefix 102 — not deterministic. ';
    if (master) evidence += 'Present in Account master (would be COA). ';

    const glRow = coaReconcile.glReadiness.find((r) => r.code === FORENSIC_AMBIGUOUS_GL);
    const ownerResolved =
      glRow?.status === 'RESOLVED_TO_TARGET_ACCOUNT' &&
      glRow.resolutionClassification === 'OWNER_APPROVED_MAPPING';

    rows.push({
      code: FORENSIC_AMBIGUOUS_GL,
      partyLinked: exactParty,
      classification: ownerResolved
        ? 'RESOLVED_BY_OWNER_OVERRIDE'
        : exactParty
          ? 'PARTY_EVIDENCE_FOUND'
          : 'STILL_AMBIGUOUS',
      evidence: ownerResolved ? glRow.reason : evidence.trim(),
    });
  }

  if (!rows.some((r) => r.code === FORENSIC_AMBIGUOUS_GL)) {
    const normalized = normalizeLegacyAccountCode(FORENSIC_AMBIGUOUS_GL);
    const glRow = coaReconcile.glReadiness.find((r) => r.code === normalized);
    const ownerResolved =
      glRow?.status === 'RESOLVED_TO_TARGET_ACCOUNT' &&
      glRow.resolutionClassification === 'OWNER_APPROVED_MAPPING';
    rows.push({
      code: normalized,
      partyLinked: partyAccounts.has(normalized),
      classification: ownerResolved
        ? 'RESOLVED_BY_OWNER_OVERRIDE'
        : partyAccounts.has(normalized)
          ? 'PARTY_EVIDENCE_FOUND'
          : 'STILL_AMBIGUOUS',
      evidence: ownerResolved
        ? glRow!.reason
        : 'Forensic check: party masters do not explain 102060101003; requires owner-approved override.',
    });
  }

  return { rows, coaReconcile };
}
