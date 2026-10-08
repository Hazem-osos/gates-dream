'use client';

type Col = { id: string; width: number };

export function ResizableColGroup({ columns }: { columns: Col[] | null }) {
  if (!columns?.length) return null;
  return (
    <colgroup>
      {columns.map((col) => (
        <col key={col.id} style={{ width: col.width, minWidth: col.width }} />
      ))}
    </colgroup>
  );
}
