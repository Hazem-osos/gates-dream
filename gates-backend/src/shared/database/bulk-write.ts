const DEFAULT_CHUNK = 500;

/**
 * Single-roundtrip bulk insert helper. Callers must pass already-mapped
 * rows — never iterate `create()` per line.
 */
export async function bulkCreateMany<T>(
  createMany: (args: { data: T[] }) => Promise<{ count: number }>,
  rows: T[],
  chunkSize = DEFAULT_CHUNK
): Promise<number> {
  if (rows.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const result = await createMany({ data: chunk });
    count += result.count;
  }
  return count;
}
