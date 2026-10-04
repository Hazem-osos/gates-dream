import type { ContractingSettlementStatus } from '@prisma/client';
import { amountsEqualAt4 } from '../../../shared/utils/decimal-round';

export type { ContractingSettlementStatus };

export function deriveContractingSettlementStatus(
  settledAmount: number,
  eligibleAmount: number
): ContractingSettlementStatus {
  if (settledAmount <= 0.0001) return 'UNPAID';
  if (
    settledAmount >= eligibleAmount - 0.0001 ||
    amountsEqualAt4(settledAmount, eligibleAmount)
  ) {
    return 'SETTLED';
  }
  return 'PARTIALLY_SETTLED';
}

export function assertPositiveAllocationAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0.0001) {
    throw new Error('ALLOCATION_AMOUNT_INVALID');
  }
}

export const ACTIVE_SETTLEMENT_BLOCKS_REVERSAL = 'ACTIVE_SETTLEMENT_BLOCKS_REVERSAL';
export const LATER_CERTIFICATE_BLOCKS_REVERSAL = 'LATER_CERTIFICATE_BLOCKS_REVERSAL';

export function assertAllocationWithinRemaining(
  amount: number,
  remaining: number,
  message = 'ALLOCATION_EXCEEDS_REMAINING'
) {
  if (amount > remaining + 0.0001) {
    throw new Error(message);
  }
}
