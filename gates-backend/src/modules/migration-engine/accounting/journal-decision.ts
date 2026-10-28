import { Decimal } from '@prisma/client/runtime/library';
import { isBalanced, money2 } from './journal-money';

export type JournalImportDecision =
  | 'IMPORT'
  | 'SKIP_ALREADY_MAPPED'
  | 'SKIP_UNPOSTED'
  | 'SKIP_DELETED'
  | 'QUARANTINE_UNBALANCED'
  | 'QUARANTINE_UNRESOLVED_ACCOUNT'
  | 'QUARANTINE_EMPTY';

export interface JournalDecisionResult {
  decision: JournalImportDecision;
  reason: string;
  difference?: string;
}

export function decidePostedJournalImport(params: {
  isPosted: boolean;
  isDeleted: boolean;
  alreadyMapped: boolean;
  lineCount: number;
  debitBase: Decimal;
  creditBase: Decimal;
  unresolvedAccountCodes: string[];
}): JournalDecisionResult {
  if (params.alreadyMapped) {
    return { decision: 'SKIP_ALREADY_MAPPED', reason: 'Id map already has this journal' };
  }
  if (params.isDeleted) {
    return { decision: 'SKIP_DELETED', reason: 'Legacy header Deleted=T' };
  }
  if (!params.isPosted) {
    return { decision: 'SKIP_UNPOSTED', reason: 'Posted-only historical import' };
  }
  if (params.lineCount === 0) {
    return { decision: 'QUARANTINE_EMPTY', reason: 'Posted journal has no detail lines' };
  }
  if (params.unresolvedAccountCodes.length) {
    return {
      decision: 'QUARANTINE_UNRESOLVED_ACCOUNT',
      reason: `Unresolved account(s): ${params.unresolvedAccountCodes.join(', ')}`,
    };
  }
  if (!isBalanced(params.debitBase, params.creditBase)) {
    const difference = params.debitBase.sub(params.creditBase);
    return {
      decision: 'QUARANTINE_UNBALANCED',
      reason: `Posted journal debitBase ${money2(params.debitBase)} ≠ creditBase ${money2(params.creditBase)}`,
      difference: money2(difference),
    };
  }
  return { decision: 'IMPORT', reason: 'Posted, balanced, accounts resolved' };
}
