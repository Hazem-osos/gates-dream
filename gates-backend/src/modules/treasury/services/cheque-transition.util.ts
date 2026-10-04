import { AppError } from '../../../shared/middleware/error-handler';

/**
 * Single source of truth for which `(direction, fromStatus) -> action`
 * transitions are legal.
 *
 * Inward:  UNDER_HAND   -> SENT_TO_BANK | ENDORSED | CANCELLED
 *          SENT_TO_BANK -> COLLECTED | BOUNCED | UNDER_HAND (unsend)
 *          ENDORSED     -> BOUNCED | UNDER_HAND (unendorse)
 *          BOUNCED      -> SENT_TO_BANK | ENDORSED (unbounce, restores prior state)
 *          COLLECTED    -> SENT_TO_BANK (unclear)
 * Outward: UNDER_HAND   -> COLLECTED | CANCELLED
 *          COLLECTED    -> UNDER_HAND (unclear)
 *
 * Inward `BOUNCE` is only legal from `SENT_TO_BANK`/`ENDORSED` — a cheque
 * that has collected (`COLLECTED`) must be un-cleared back to `SENT_TO_BANK`
 * first before it can bounce.
 */
export type ChequeAction =
  | 'SEND_TO_BANK'
  | 'UNSEND_TO_BANK'
  | 'CLEAR'
  | 'UNCLEAR'
  | 'BOUNCE'
  | 'UNBOUNCE'
  | 'ENDORSE'
  | 'UNENDORSE'
  | 'CANCEL';

const INWARD_TRANSITIONS: Record<ChequeAction, string[]> = {
  SEND_TO_BANK: ['UNDER_HAND'],
  UNSEND_TO_BANK: ['SENT_TO_BANK'],
  CLEAR: ['SENT_TO_BANK'],
  UNCLEAR: ['COLLECTED'],
  BOUNCE: ['SENT_TO_BANK', 'ENDORSED'],
  UNBOUNCE: ['BOUNCED'],
  ENDORSE: ['UNDER_HAND'],
  UNENDORSE: ['ENDORSED'],
  CANCEL: ['UNDER_HAND'],
};

const OUTWARD_TRANSITIONS: Record<ChequeAction, string[]> = {
  SEND_TO_BANK: [],
  UNSEND_TO_BANK: [],
  CLEAR: ['UNDER_HAND'],
  UNCLEAR: ['COLLECTED'],
  BOUNCE: [],
  UNBOUNCE: [],
  ENDORSE: [],
  UNENDORSE: [],
  CANCEL: ['UNDER_HAND'],
};

const STATUS_AR: Record<string, string> = {
  UNDER_HAND: 'في الخزينة',
  SENT_TO_BANK: 'برسم التحصيل',
  COLLECTED: 'محصّل',
  ENDORSED: 'مظهَّر لمورد',
  BOUNCED: 'مرتد',
  RETURNED_TO_DRAWER: 'مردود للساحب',
  CANCELLED: 'ملغي',
};

const ACTION_AR: Record<ChequeAction, string> = {
  SEND_TO_BANK: 'إيداعه في البنك',
  UNSEND_TO_BANK: 'فك إيداعه',
  CLEAR: 'تحصيله',
  UNCLEAR: 'فك تحصيله',
  BOUNCE: 'ارتداده',
  UNBOUNCE: 'فك ارتداده',
  ENDORSE: 'تظهيره',
  UNENDORSE: 'فك تظهيره',
  CANCEL: 'إلغاؤه',
};

function statusLabel(status: string): string {
  return STATUS_AR[status] ?? status;
}

export function assertChequeTransition(
  direction: 'INWARD' | 'OUTWARD',
  currentStatus: string,
  action: ChequeAction
): void {
  const table = direction === 'INWARD' ? INWARD_TRANSITIONS : OUTWARD_TRANSITIONS;
  const allowedFrom = table[action];
  if (allowedFrom.includes(currentStatus)) return;

  const paper = direction === 'OUTWARD' ? 'شيك الصرف' : 'شيك القبض';
  if (allowedFrom.length === 0) {
    throw new AppError(400, `هذه العملية غير متاحة على ${paper}.`);
  }
  const needed = allowedFrom.map(statusLabel).join(' أو ');
  throw new AppError(
    400,
    `${paper} حالته «${statusLabel(currentStatus)}». لا يمكن ${ACTION_AR[action]} من هذه الحالة. لازم يكون ${needed} أولاً.`
  );
}
