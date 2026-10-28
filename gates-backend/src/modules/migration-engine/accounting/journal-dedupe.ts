import { money } from './journal-money';
import type { LegacyJournalHeaderInput, LegacyJournalLineInput } from '../transforms/journal-transform';
import { legacyTrim, padGlNum } from '../transforms/legacy-values';

export function postedJournalIdentity(row: {
  YearID?: unknown;
  BranchCode?: unknown;
  GlNum?: unknown;
  GLNum?: unknown;
}): string {
  return `${legacyTrim(row.YearID)}|${legacyTrim(row.BranchCode)}|${padGlNum(row.GlNum ?? row.GLNum)}`;
}

export function legacyJournalLineIdentity(row: LegacyJournalLineInput): string {
  return [
    postedJournalIdentity(row),
    String(row.DetailNum ?? ''),
    String(row.IdNum ?? ''),
    legacyTrim(row.AccountNo ?? row.AccountCode),
    money(row.DebitValue ?? row.Debit).toFixed(4),
    money(row.CreditValue ?? row.Credit).toFixed(4),
  ].join('|');
}

/**
 * Legacy allows multiple posted headers on the same GlNum (typically SV01 + BR02
 * cash collection). Details are stored once. Import the first header only.
 */
export function dedupePostedJournalHeaders(headers: LegacyJournalHeaderInput[]): {
  headers: LegacyJournalHeaderInput[];
  collapsed: Array<{ identity: string; keptType: string; droppedTypes: string[] }>;
} {
  const seen = new Map<string, LegacyJournalHeaderInput>();
  const dropped = new Map<string, string[]>();
  for (const header of headers) {
    const identity = postedJournalIdentity(header);
    const existing = seen.get(identity);
    if (!existing) {
      seen.set(identity, header);
      continue;
    }
    const list = dropped.get(identity) ?? [];
    list.push(legacyTrim(header.Type) || '?');
    dropped.set(identity, list);
  }
  const collapsed = [...dropped.entries()].map(([identity, droppedTypes]) => ({
    identity,
    keptType: legacyTrim(seen.get(identity)?.Type) || '',
    droppedTypes,
  }));
  return { headers: [...seen.values()], collapsed };
}

export function dedupeLegacyJournalLines(lines: LegacyJournalLineInput[]): LegacyJournalLineInput[] {
  const seen = new Set<string>();
  const out: LegacyJournalLineInput[] = [];
  for (const line of lines) {
    const key = legacyJournalLineIdentity(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}
