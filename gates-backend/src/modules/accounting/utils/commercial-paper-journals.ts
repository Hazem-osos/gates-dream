import type { JournalEntryLineData } from '../types/journal-entry.types';

export const PAPER_JOURNAL_ENTRY_TYPE = {
  ISSUE: 'تحرير',
  COLLECT: 'تحصيل',
  BOUNCE: 'ارتداد',
  ENDORSE: 'تظهير',
  MULTI: 'تحصيل متعدد',
} as const;

export type PaperJournalEntryType =
  (typeof PAPER_JOURNAL_ENTRY_TYPE)[keyof typeof PAPER_JOURNAL_ENTRY_TYPE];

export const PAPER_LIFECYCLE = {
  ISSUED: 'ISSUED',
  COLLECTED: 'COLLECTED',
  BOUNCED: 'BOUNCED',
  ENDORSED: 'ENDORSED',
  MULTI_COLLECTED: 'MULTI_COLLECTED',
} as const;

export type PaperLifecycleStatus = (typeof PAPER_LIFECYCLE)[keyof typeof PAPER_LIFECYCLE];

export const PAPER_JOURNAL_LABELS: Record<string, string> = {
  [PAPER_JOURNAL_ENTRY_TYPE.ISSUE]: 'قيد تحرير',
  [PAPER_JOURNAL_ENTRY_TYPE.COLLECT]: 'قيد تحصيل',
  [PAPER_JOURNAL_ENTRY_TYPE.BOUNCE]: 'قيد ارتداد',
  [PAPER_JOURNAL_ENTRY_TYPE.ENDORSE]: 'قيد تظهير',
  [PAPER_JOURNAL_ENTRY_TYPE.MULTI]: 'قيد تحصيل متعدد',
  REVERSAL: 'عكس قيد',
  SecuritiesReceipt: 'قيد تحرير',
  SecuritiesPayment: 'قيد تحرير',
  MULTI_COLLECTION: 'قيد تحصيل متعدد',
};

export function paperJournalLabel(entryType?: string | null, voucherNumber?: string | null): string {
  const base = PAPER_JOURNAL_LABELS[entryType ?? ''] || entryType?.trim() || 'قيد';
  return voucherNumber ? `${base} — ${voucherNumber}` : base;
}

export function isLifecycleBeyondIssue(status?: string | null): boolean {
  return Boolean(status && status !== PAPER_LIFECYCLE.ISSUED);
}

type LineOpts = {
  notesAccountId: string;
  partyAccountId: string;
  bankAccountId?: string;
  supplierAccountId?: string;
  amount: number;
  costCenterId?: string | null;
  description?: string;
};

function line(
  accountId: string,
  debit: number,
  credit: number,
  order: number,
  opts: Pick<LineOpts, 'costCenterId' | 'description'>
): JournalEntryLineData {
  return {
    accountId,
    debit,
    credit,
    lineOrder: order,
    costCenterId: opts.costCenterId || undefined,
    description: opts.description,
  };
}

/** ورقة مقبوضات — تحرير: مدين أوراق قبض / دائن الطرف */
export function buildReceiptIssueLines(opts: LineOpts): JournalEntryLineData[] {
  return [
    line(opts.notesAccountId, opts.amount, 0, 1, opts),
    line(opts.partyAccountId, 0, opts.amount, 2, opts),
  ];
}

/** ورقة مدفوعات — تحرير: مدين الطرف / دائن أوراق دفع */
export function buildPaymentIssueLines(opts: LineOpts): JournalEntryLineData[] {
  return [
    line(opts.partyAccountId, opts.amount, 0, 1, opts),
    line(opts.notesAccountId, 0, opts.amount, 2, opts),
  ];
}

/** تحصيل مقبوضات: مدين البنك / دائن أوراق قبض */
export function buildReceiptCollectLines(opts: LineOpts): JournalEntryLineData[] {
  if (!opts.bankAccountId) throw new Error('حساب التحصيل مطلوب');
  return [
    line(opts.bankAccountId, opts.amount, 0, 1, opts),
    line(opts.notesAccountId, 0, opts.amount, 2, opts),
  ];
}

/** تحصيل مدفوعات: مدين أوراق دفع / دائن البنك */
export function buildPaymentCollectLines(opts: LineOpts): JournalEntryLineData[] {
  if (!opts.bankAccountId) throw new Error('حساب التحصيل مطلوب');
  return [
    line(opts.notesAccountId, opts.amount, 0, 1, opts),
    line(opts.bankAccountId, 0, opts.amount, 2, opts),
  ];
}

/** ارتداد ورقة محررة فقط: عكس التحرير */
export function buildIssuedBounceLines(
  paperKind: 'RECEIPT' | 'PAYMENT',
  opts: LineOpts
): JournalEntryLineData[] {
  return paperKind === 'RECEIPT' ? buildPaymentIssueLines(opts) : buildReceiptIssueLines(opts);
}

/** ارتداد بعد التحصيل: مدين الطرف / دائن البنك (مقبوضات) أو العكس (مدفوعات) */
export function buildCollectedBounceLines(
  paperKind: 'RECEIPT' | 'PAYMENT',
  opts: LineOpts
): JournalEntryLineData[] {
  if (!opts.bankAccountId) throw new Error('حساب التحصيل مطلوب لعكس التحصيل');
  if (paperKind === 'RECEIPT') {
    return [
      line(opts.partyAccountId, opts.amount, 0, 1, opts),
      line(opts.bankAccountId, 0, opts.amount, 2, opts),
    ];
  }
  return [
    line(opts.bankAccountId, opts.amount, 0, 1, opts),
    line(opts.partyAccountId, 0, opts.amount, 2, opts),
  ];
}

/** تظهير مقبوضات: مدين المورد / دائن أوراق قبض */
export function buildEndorseLines(opts: LineOpts): JournalEntryLineData[] {
  if (!opts.supplierAccountId) throw new Error('حساب المظهَّر إليه مطلوب');
  return [
    line(opts.supplierAccountId, opts.amount, 0, 1, opts),
    line(opts.notesAccountId, 0, opts.amount, 2, opts),
  ];
}

/** ارتداد بعد التظهير: إعادة المديونية للعميل وإعادة التزام المورد */
export function buildEndorsedBounceLines(opts: LineOpts): JournalEntryLineData[] {
  if (!opts.supplierAccountId) throw new Error('حساب المظهَّر إليه مطلوب');
  return [
    line(opts.partyAccountId, opts.amount, 0, 1, opts),
    line(opts.notesAccountId, 0, opts.amount, 2, opts),
    line(opts.notesAccountId, opts.amount, 0, 3, opts),
    line(opts.supplierAccountId, 0, opts.amount, 4, opts),
  ];
}
