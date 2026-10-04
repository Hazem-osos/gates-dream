import { AppError } from '../../../shared/middleware/error-handler';

export const PAPER_DUE_BEFORE_ISSUE = 'تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ التحرير';

function calendarDay(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** True when both dates exist and the due day is strictly before the paper day. */
export function paperDueBeforeIssue(
  issueDate: Date | string | null | undefined,
  dueDate: Date | string | null | undefined
): boolean {
  const issueDay = calendarDay(issueDate);
  const dueDay = calendarDay(dueDate);
  if (!issueDay || !dueDay) return false;
  return dueDay < issueDay;
}

export function assertPaperDueOnOrAfterIssue(
  issueDate: Date | string | null | undefined,
  dueDate: Date | string | null | undefined,
  paperNumber?: string
) {
  if (!paperDueBeforeIssue(issueDate, dueDate)) return;
  throw new AppError(
    400,
    paperNumber ? `تاريخ استحقاق الورقة ${paperNumber} لا يمكن أن يكون قبل تاريخ التحرير` : PAPER_DUE_BEFORE_ISSUE
  );
}
