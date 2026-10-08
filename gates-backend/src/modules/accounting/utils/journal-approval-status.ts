/** Arabic label for journal entry `isApproved` (موقف التأييد), not posting. */
export function journalApprovalStatusLabel(
  isApproved: boolean | number | bigint | null | undefined
): string {
  return journalEntryIsApprovedFlag(isApproved) ? 'مؤيد' : 'غير مؤيد';
}

export function journalEntryIsApprovedFlag(
  isApproved: boolean | number | bigint | null | undefined
): boolean {
  if (typeof isApproved === 'boolean') return isApproved;
  if (typeof isApproved === 'bigint') return isApproved === BigInt(1);
  return Number(isApproved) === 1;
}
