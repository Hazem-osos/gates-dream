import type { LegacyCoaSnapshot } from './legacy-coa-data.service';

export interface AccountUniverseBuckets {
  masterOnly: string[];
  masterAndGl: string[];
  glOnlyPosted: string[];
  balanceOnly: string[];
  otherReferenceOnly: string[];
  requiredForPostedGl: string[];
}

export function buildAccountUniverse(snapshot: LegacyCoaSnapshot): AccountUniverseBuckets {
  const masterOnly: string[] = [];
  const masterAndGl: string[] = [];
  const glOnlyPosted: string[] = [];
  const balanceOnly: string[] = [];
  const otherReferenceOnly: string[] = [];

  for (const code of snapshot.masterCodes) {
    if (snapshot.postedGlCodes.has(code)) masterAndGl.push(code);
    else masterOnly.push(code);
  }

  for (const code of snapshot.postedGlCodes) {
    if (!snapshot.masterCodes.has(code)) glOnlyPosted.push(code);
  }

  for (const code of snapshot.balanceAccountCodes) {
    if (!snapshot.masterCodes.has(code) && !snapshot.postedGlCodes.has(code)) {
      balanceOnly.push(code);
    }
  }

  for (const code of snapshot.partyAccountCodes) {
    if (
      !snapshot.masterCodes.has(code) &&
      !snapshot.postedGlCodes.has(code) &&
      !snapshot.balanceAccountCodes.has(code)
    ) {
      otherReferenceOnly.push(code);
    }
  }

  const required = new Set<string>([...snapshot.masterCodes, ...snapshot.postedGlCodes]);

  return {
    masterOnly: masterOnly.sort(),
    masterAndGl: masterAndGl.sort(),
    glOnlyPosted: glOnlyPosted.sort(),
    balanceOnly: balanceOnly.sort(),
    otherReferenceOnly: otherReferenceOnly.sort(),
    requiredForPostedGl: [...required].sort(),
  };
}
