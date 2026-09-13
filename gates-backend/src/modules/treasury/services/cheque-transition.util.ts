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

const ACTION_LABEL: Record<ChequeAction, string> = {
  SEND_TO_BANK: 'sent to bank',
  UNSEND_TO_BANK: 'un-sent from bank',
  CLEAR: 'cleared',
  UNCLEAR: 'un-cleared',
  BOUNCE: 'bounced',
  UNBOUNCE: 'un-bounced',
  ENDORSE: 'endorsed',
  UNENDORSE: 'un-endorsed',
  CANCEL: 'cancelled',
};

export function assertChequeTransition(
  direction: 'INWARD' | 'OUTWARD',
  currentStatus: string,
  action: ChequeAction
): void {
  const table = direction === 'INWARD' ? INWARD_TRANSITIONS : OUTWARD_TRANSITIONS;
  const allowedFrom = table[action];
  if (allowedFrom.length === 0 || !allowedFrom.includes(currentStatus)) {
    throw new AppError(
      400,
      `A ${direction.toLowerCase()} cheque in status "${currentStatus}" cannot be ${ACTION_LABEL[action]}` +
        (allowedFrom.length > 0 ? ` (requires: ${allowedFrom.join(', ')})` : ' — action not supported for this direction')
    );
  }
}
