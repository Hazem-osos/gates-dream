import {
  journalApprovalStatusLabel,
  journalEntryIsApprovedFlag,
} from './journal-approval-status';

describe('journal-approval-status', () => {
  it('labels approved state', () => {
    expect(journalApprovalStatusLabel(true)).toBe('مؤيد');
    expect(journalApprovalStatusLabel(1)).toBe('مؤيد');
    expect(journalApprovalStatusLabel(0)).toBe('غير مؤيد');
    expect(journalApprovalStatusLabel(false)).toBe('غير مؤيد');
    expect(journalEntryIsApprovedFlag(1)).toBe(true);
    expect(journalEntryIsApprovedFlag(0)).toBe(false);
  });
});
