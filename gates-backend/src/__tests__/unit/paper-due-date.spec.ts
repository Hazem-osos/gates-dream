import { AppError } from '../../shared/middleware/error-handler';
import { assertPaperDueOnOrAfterIssue, paperDueBeforeIssue } from '../../modules/accounting/utils/paper-due-date';

describe('paper due date', () => {
  it('rejects a due date before the paper date', () => {
    expect(paperDueBeforeIssue('2026-09-29', '2026-09-28')).toBe(true);
    expect(() => assertPaperDueOnOrAfterIssue('2026-09-29', '2026-09-28')).toThrow(AppError);
  });

  it('allows the due date on the paper date or after it', () => {
    expect(paperDueBeforeIssue('2026-09-29', '2026-09-29')).toBe(false);
    expect(paperDueBeforeIssue('2026-09-29', '2026-10-01')).toBe(false);
    expect(() => assertPaperDueOnOrAfterIssue('2026-09-29', '2026-09-29')).not.toThrow();
  });

  it('names the paper when a batch line is early', () => {
    expect(() => assertPaperDueOnOrAfterIssue('2026-09-29', '2026-01-01', '15')).toThrow(
      'تاريخ استحقاق الورقة 15 لا يمكن أن يكون قبل تاريخ التحرير'
    );
  });
});
