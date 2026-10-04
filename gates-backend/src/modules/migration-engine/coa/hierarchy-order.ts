import type { LegacyAccountMasterRow } from '../services/legacy-coa-data.service';

export class CoaHierarchyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoaHierarchyError';
  }
}

/** Topological order: parents before children. Detects cycles and missing parents. */
export function orderMasterAccountsForInsert(
  masters: LegacyAccountMasterRow[],
  extraCodes: string[] = []
): string[] {
  const byCode = new Map(masters.map((m) => [m.accountCode, m]));
  const allCodes = new Set([...masters.map((m) => m.accountCode), ...extraCodes]);

  const children = new Map<string, string[]>();
  for (const m of masters) {
    const p = m.parentAccount?.trim();
    if (!p) continue;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(m.accountCode);
  }

  for (const m of masters) {
    const p = m.parentAccount?.trim();
    if (p && !byCode.has(p) && allCodes.has(m.accountCode)) {
      throw new CoaHierarchyError(`Orphan parent ${p} for account ${m.accountCode}`);
    }
    if (p === m.accountCode) {
      throw new CoaHierarchyError(`Self-parent account ${m.accountCode}`);
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const ordered: string[] = [];

  function visit(code: string) {
    if (visited.has(code)) return;
    if (stack.has(code)) {
      throw new CoaHierarchyError(`Cycle detected at account ${code}`);
    }
    stack.add(code);
    const row = byCode.get(code);
    const parent = row?.parentAccount?.trim();
    if (parent && byCode.has(parent)) visit(parent);
    visited.add(code);
    stack.delete(code);
    ordered.push(code);
  }

  for (const code of allCodes) {
    if (byCode.has(code)) visit(code);
  }
  for (const code of extraCodes) {
    if (!visited.has(code)) ordered.push(code);
  }

  return ordered;
}
