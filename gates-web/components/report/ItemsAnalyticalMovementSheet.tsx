'use client';

type Row = Record<string, unknown>;

export type ItemsAnalyticalDelegate = { id: string; name: string };
export type ItemsAnalyticalCell = { quantity: number; amount: number };

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function figure(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cellOf(row: Row, delegateId: string): ItemsAnalyticalCell {
  const cells = row.cells;
  if (!cells || typeof cells !== 'object') return { quantity: 0, amount: 0 };
  const cell = (cells as Record<string, unknown>)[delegateId];
  if (!cell || typeof cell !== 'object') return { quantity: 0, amount: 0 };
  const record = cell as Record<string, unknown>;
  return { quantity: num(record.quantity), amount: num(record.amount) };
}

export function readItemsAnalyticalSheet(summary: unknown, rows: Row[]) {
  const source = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : {};
  const rawDelegates = Array.isArray(source.delegates) ? source.delegates : [];
  const delegates: ItemsAnalyticalDelegate[] = rawDelegates.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    if (!id) return [];
    const name = typeof record.name === 'string' && record.name.trim() ? record.name : 'مندوب';
    return [{ id, name }];
  });

  if (!delegates.length) {
    const seen = new Set<string>();
    for (const row of rows) {
      const cells = row.cells;
      if (!cells || typeof cells !== 'object') continue;
      for (const id of Object.keys(cells as Record<string, unknown>)) {
        if (seen.has(id)) continue;
        seen.add(id);
        delegates.push({ id, name: id === 'none' ? 'بدون مندوب' : 'مندوب' });
      }
    }
  }

  const totals: Record<string, ItemsAnalyticalCell> = {};
  for (const delegate of delegates) {
    const total = { quantity: 0, amount: 0 };
    for (const row of rows) {
      const cell = cellOf(row, delegate.id);
      total.quantity += cell.quantity;
      total.amount += cell.amount;
    }
    totals[delegate.id] = {
      quantity: Math.round(total.quantity * 10000) / 10000,
      amount: Math.round(total.amount * 10000) / 10000,
    };
  }

  return { delegates, totals };
}

export function ItemsAnalyticalMovementSheet({ rows, summary }: { rows: Row[]; summary?: unknown }) {
  const { delegates, totals } = readItemsAnalyticalSheet(summary, rows);

  return (
    <div className="overflow-x-auto rounded-md border border-[#9BB6CE] bg-white" data-print-layout="landscape">
      <table className="min-w-full border-collapse text-xs text-slate-800" dir="rtl">
        <thead>
          <tr className="bg-[#4F86C6] text-white">
            <th rowSpan={2} className="min-w-24 border border-[#3E6FA6] px-2 py-2 text-center font-semibold">
              الكود
            </th>
            <th rowSpan={2} className="min-w-40 border border-[#3E6FA6] px-2 py-2 text-center font-semibold">
              الصنف
            </th>
            {delegates.map((delegate) => (
              <th key={delegate.id} colSpan={2} className="border border-[#3E6FA6] px-2 py-2 text-center font-semibold">
                {delegate.name}
              </th>
            ))}
          </tr>
          <tr className="bg-[#5B94D1] text-white">
            {delegates.map((delegate) => (
              <PairHeaders key={delegate.id} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.itemId ?? index)} className="bg-white">
              <td className="border border-[#D5E1EC] px-2 py-1.5 text-center whitespace-nowrap">
                {String(row.itemSerial ?? '') || '—'}
              </td>
              <td className="border border-[#D5E1EC] px-2 py-1.5 text-right">{String(row.itemName ?? '') || '—'}</td>
              {delegates.map((delegate) => (
                <PairCells key={delegate.id} cell={cellOf(row, delegate.id)} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#E8F1FA] font-semibold text-[#0E4C6E]">
            <td className="border border-[#B7C9D9] px-2 py-2" />
            <td className="border border-[#B7C9D9] px-2 py-2 text-right">الإجمالي</td>
            {delegates.map((delegate) => (
              <PairCells key={delegate.id} cell={totals[delegate.id] ?? { quantity: 0, amount: 0 }} strong />
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PairHeaders() {
  return (
    <>
      <th className="min-w-24 border border-[#3E6FA6] px-2 py-1.5 text-center font-medium">الكمية</th>
      <th className="min-w-28 border border-[#3E6FA6] px-2 py-1.5 text-center font-medium">القيمة</th>
    </>
  );
}

function PairCells({ cell, strong = false }: { cell: ItemsAnalyticalCell; strong?: boolean }) {
  return (
    <>
      <td className={`border px-2 py-1.5 text-center tabular-nums ${strong ? 'border-[#B7C9D9]' : 'border-[#D5E1EC]'}`}>
        {figure(cell.quantity)}
      </td>
      <td className={`border px-2 py-1.5 text-center tabular-nums ${strong ? 'border-[#B7C9D9]' : 'border-[#D5E1EC]'}`}>
        {figure(cell.amount)}
      </td>
    </>
  );
}
