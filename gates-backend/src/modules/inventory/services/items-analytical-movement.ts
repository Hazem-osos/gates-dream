import { roundTo4 } from '../../../shared/utils/decimal-round';

export type AnalyticalDelegateColumn = {
  id: string;
  name: string;
};

export type AnalyticalItemMovementLine = {
  itemId: string;
  itemSerial: string;
  itemName: string;
  delegateId: string;
  delegateName: string;
  quantity: number;
  amount: number;
};

export type AnalyticalItemCell = {
  quantity: number;
  amount: number;
};

export type AnalyticalItemRow = {
  itemId: string;
  itemSerial: string;
  itemName: string;
  cells: Record<string, AnalyticalItemCell>;
};

const NONE_DELEGATE = 'none';

function emptyCell(): AnalyticalItemCell {
  return { quantity: 0, amount: 0 };
}

function addCell(cell: AnalyticalItemCell, quantity: number, amount: number) {
  cell.quantity = roundTo4(cell.quantity + quantity);
  cell.amount = roundTo4(cell.amount + amount);
}

/**
 * One row per item. Each delegate is a column pair (quantity, amount), including delegates with no movement.
 */
export function buildItemsAnalyticalMovement(
  lines: AnalyticalItemMovementLine[],
  delegates: AnalyticalDelegateColumn[]
): {
  rows: AnalyticalItemRow[];
  summary: {
    delegates: AnalyticalDelegateColumn[];
    totals: Record<string, AnalyticalItemCell>;
    itemCount: number;
  };
} {
  const columns: AnalyticalDelegateColumn[] = [];
  const seen = new Set<string>();

  for (const delegate of delegates) {
    if (!delegate.id || seen.has(delegate.id)) continue;
    seen.add(delegate.id);
    columns.push({ id: delegate.id, name: delegate.name || 'مندوب' });
  }

  const items = new Map<string, { itemSerial: string; itemName: string; cells: Map<string, AnalyticalItemCell> }>();

  for (const line of lines) {
    if (!line.itemId) continue;
    const delegateId = line.delegateId || NONE_DELEGATE;
    if (!seen.has(delegateId)) {
      seen.add(delegateId);
      columns.push({
        id: delegateId,
        name: delegateId === NONE_DELEGATE ? 'بدون مندوب' : line.delegateName || 'مندوب',
      });
    }

    let bucket = items.get(line.itemId);
    if (!bucket) {
      bucket = { itemSerial: line.itemSerial ?? '', itemName: line.itemName ?? '', cells: new Map() };
      items.set(line.itemId, bucket);
    }
    let cell = bucket.cells.get(delegateId);
    if (!cell) {
      cell = emptyCell();
      bucket.cells.set(delegateId, cell);
    }
    addCell(cell, line.quantity, line.amount);
  }

  const named = columns.filter((column) => column.id !== NONE_DELEGATE);
  const none = columns.filter((column) => column.id === NONE_DELEGATE);
  named.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const ordered = [...named, ...none];

  const rows = [...items.entries()]
    .map(([itemId, bucket]) => {
      const cells: Record<string, AnalyticalItemCell> = {};
      let totalQty = 0;
      let totalAmount = 0;
      for (const column of ordered) {
        const cell = bucket.cells.get(column.id) ?? emptyCell();
        cells[column.id] = cell;
        totalQty = roundTo4(totalQty + cell.quantity);
        totalAmount = roundTo4(totalAmount + cell.amount);
      }
      return {
        itemId,
        itemSerial: bucket.itemSerial,
        itemName: bucket.itemName,
        cells,
        totalQty,
        totalAmount,
      };
    })
    .filter((row) => row.totalQty !== 0 || row.totalAmount !== 0)
    .sort((a, b) => {
      const bySerial = a.itemSerial.localeCompare(b.itemSerial, 'ar', { numeric: true });
      if (bySerial !== 0) return bySerial;
      return a.itemName.localeCompare(b.itemName, 'ar');
    })
    .map(({ totalQty: _qty, totalAmount: _amount, ...row }) => row);

  const totals: Record<string, AnalyticalItemCell> = {};
  for (const column of ordered) {
    const total = emptyCell();
    for (const row of rows) {
      addCell(total, row.cells[column.id]?.quantity ?? 0, row.cells[column.id]?.amount ?? 0);
    }
    totals[column.id] = total;
  }

  return {
    rows,
    summary: {
      delegates: ordered,
      totals,
      itemCount: rows.length,
    },
  };
}
