import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';

export type TreasuryPostingContext = JournalPostingContext;

export type CashTransactionKind = 'RECEIPT' | 'PAYMENT';
export type CashVoucherFamily = 'BP01' | 'BR01' | 'KP01' | 'KR01';
export type CashFundType = 'CASHBOX' | 'BANK_ACCOUNT';
export type CashAllocationSide = 'AP' | 'AR';

export type ChequeDirection = 'INWARD' | 'OUTWARD';

export type InwardChequeStatus =
  | 'UNDER_HAND'
  | 'SENT_TO_BANK'
  | 'COLLECTED'
  | 'BOUNCED'
  | 'ENDORSED'
  | 'RETURNED_TO_DRAWER'
  | 'CANCELLED';

export type OutwardChequeStatus = 'UNDER_HAND' | 'COLLECTED' | 'CANCELLED';

export type ChequeStatus = InwardChequeStatus | OutwardChequeStatus;

export interface ResolvedTreasuryAccounts {
  cashAccountId: string;
  bankAccountId?: string;
  chequesUnderHandAccountId: string;
  chequesUnderCollectionAccountId: string;
  notesPayableAccountId: string;
  partyAccountId?: string;
}
