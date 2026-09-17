import { AppError } from '../../../shared/middleware/error-handler';

export const SECURITIES_PAPER_CASES = {
  ISSUED: 'ISSUED',
  COLLECTED: 'COLLECTED',
  MULTI_COLLECTED: 'MULTI_COLLECTED',
  ENDORSED: 'ENDORSED',
  BOUNCED: 'BOUNCED',
} as const;

export type SecuritiesPaperCase = (typeof SECURITIES_PAPER_CASES)[keyof typeof SECURITIES_PAPER_CASES];

export const SECURITIES_PAPER_CASE_LABEL: Record<SecuritiesPaperCase, string> = {
  ISSUED: 'محررة',
  COLLECTED: 'محصلة',
  MULTI_COLLECTED: 'تحصيل متعدد',
  ENDORSED: 'مظهرة',
  BOUNCED: 'مرتدة',
};

export function resolveSecuritiesPaperCase(paper: {
  paperCase?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  multiCollectionLines?: unknown[] | null;
  description?: string | null;
}): SecuritiesPaperCase {
  const raw = paper.paperCase;
  if (
    raw === 'COLLECTED' ||
    raw === 'MULTI_COLLECTED' ||
    raw === 'ENDORSED' ||
    raw === 'BOUNCED' ||
    raw === 'ISSUED'
  ) {
    return raw;
  }
  if (paper.isCancelled) return 'BOUNCED';
  if (paper.isPosted && Array.isArray(paper.multiCollectionLines) && paper.multiCollectionLines.length > 0) {
    return 'MULTI_COLLECTED';
  }
  if (paper.isPosted) return 'COLLECTED';
  if (paper.description?.includes('تظهير')) return 'ENDORSED';
  return 'ISSUED';
}

export function assertPaperIssued(
  paper: {
    paperCase?: string | null;
    isPosted?: boolean;
    isCancelled?: boolean;
    multiCollectionLines?: unknown[] | null;
    description?: string | null;
  },
  action: string
) {
  const current = resolveSecuritiesPaperCase(paper);
  if (current !== 'ISSUED') {
    throw new AppError(
      400,
      `الورقة حالتها «${SECURITIES_PAPER_CASE_LABEL[current]}» — فك الحالة أولاً قبل ${action}`
    );
  }
}

export const issuedPaperReset = {
  paperCase: SECURITIES_PAPER_CASES.ISSUED,
  isPosted: false,
  postedAt: null,
  journalEntryId: null,
  isCancelled: false,
  cancelledAt: null,
  commissionAmount: null,
  commissionAccountId: null,
};
