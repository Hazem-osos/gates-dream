export type TenderCatalogPickerRow = {
  id: string;
  parentId?: string | null;
};

function parentKey(
  row: TenderCatalogPickerRow,
  known: ReadonlySet<string>
): string | null {
  const raw = row.parentId ?? null;
  if (!raw || raw === row.id || !known.has(raw)) return null;
  return raw;
}

function collectDescendantIds(rows: TenderCatalogPickerRow[], rootId: string): string[] {
  const known = new Set(rows.map((row) => row.id));
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    const parent = parentKey(row, known);
    if (!parent) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(row.id);
    childrenOf.set(parent, list);
  }
  const out: string[] = [];
  const walk = (id: string) => {
    for (const childId of childrenOf.get(id) ?? []) {
      out.push(childId);
      walk(childId);
    }
  };
  walk(rootId);
  return out;
}

/** First-level check takes the node and every descendant. Deeper checks take that node only. */
export function resolveTenderCatalogPickerIds(
  rows: TenderCatalogPickerRow[],
  selectedIds: Iterable<string>
): string[] {
  const known = new Set(rows.map((row) => row.id));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const picked = new Set<string>();

  for (const id of selectedIds) {
    const row = byId.get(id);
    if (!row) continue;
    picked.add(id);
    if (parentKey(row, known) == null) {
      for (const descendantId of collectDescendantIds(rows, id)) picked.add(descendantId);
    }
  }

  return rows.filter((row) => picked.has(row.id)).map((row) => row.id);
}
