type SortDir = 'asc' | 'desc';

/**
 * Default browse-list ordering: serial/code ascending unless user picks date/amount.
 */
export function serialDocumentListOrderBy(
  sortBy?: string | null,
  sortDir?: SortDir | null,
  serialField = 'serial'
): Array<Record<string, SortDir>> {
  const dir: SortDir = sortDir === 'desc' ? 'desc' : 'asc';
  if (sortBy === 'date') {
    return [{ date: dir }, { [serialField]: 'asc' }];
  }
  if (sortBy === 'amount' || sortBy === 'total') {
    return [{ totalAmount: dir }, { [serialField]: 'asc' }];
  }
  return [{ [serialField]: dir }, { createdAt: 'asc' }];
}
