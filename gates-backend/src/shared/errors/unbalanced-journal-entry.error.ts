import { AppError } from '../middleware/error-handler';

export class UnbalancedJournalEntryError extends AppError {
  public readonly code = 'UNBALANCED_JOURNAL_ENTRY';
  public readonly details: { totalDebits: string; totalCredits: string };

  constructor(totalDebits: string, totalCredits: string) {
    super(
      422,
      `Journal entry is not balanced: debit ${totalDebits} ≠ credit ${totalCredits}`,
      true
    );
    this.details = { totalDebits, totalCredits };
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Alias used by Auto-GL posting (`Math.abs(debit - credit) < 0.001`). */
export class UnbalancedJournalEntryException extends UnbalancedJournalEntryError {}
