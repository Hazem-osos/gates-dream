/**
 * Keyset paging for legacy SQL Server reads.
 *
 * A page query must filter, sort and build the next cursor from ONE expression.
 * Sorting by the raw columns while filtering on a concatenated/padded key skips or
 * repeats rows at page boundaries (e.g. ORDER BY GlNum puts '10' before '9', but the
 * padded cursor puts '00000009' first; ORDER BY Type puts 'S' before 'SR', but the
 * key 'S|…' sorts after 'SR|…'). So the key is computed in SQL, returned with each
 * row, used for ORDER BY, and handed back verbatim as the next cursor.
 */
export const CURSOR_KEY_COLUMN = '__cursorKey';

/** SQL text for one key part: trimmed, never NULL (a NULL part would null the whole key). */
export function keyPart(sqlExpr: string): string {
  return `RTRIM(ISNULL(CONVERT(nvarchar(128), ${sqlExpr}), N''))`;
}

/** Date key part in ISO 8601 (sortable, keeps seconds). */
export function dateKeyPart(sqlExpr: string): string {
  return `ISNULL(CONVERT(nvarchar(32), ${sqlExpr}, 126), N'')`;
}

/** Concatenates key parts with '|'. */
export function keyExpr(parts: string[]): string {
  return parts.join(`+N'|'+`);
}

/** Select-list fragment, WHERE fragment and ORDER BY fragment for a keyset page. */
export function keysetSql(expr: string, hasCursor: boolean) {
  return {
    select: `${expr} AS ${CURSOR_KEY_COLUMN}`,
    filter: hasCursor ? `AND ${expr} > @cursor` : '',
    orderBy: `ORDER BY ${expr}`,
  };
}

/**
 * Strips the key column from the rows and returns the next cursor.
 * A short page (fewer rows than requested from SQL) means there is no next page.
 */
export function finishKeysetPage<T>(
  raw: Array<T & { [CURSOR_KEY_COLUMN]?: unknown }>,
  requested: number
): { rows: T[]; nextCursor: string | null } {
  const last = raw[raw.length - 1];
  const lastKey = last?.[CURSOR_KEY_COLUMN];
  const rows = raw.map((r) => {
    const copy = { ...r } as Record<string, unknown>;
    delete copy[CURSOR_KEY_COLUMN];
    return copy as T;
  });
  const nextCursor = raw.length >= requested && lastKey != null ? String(lastKey) : null;
  return { rows, nextCursor };
}
