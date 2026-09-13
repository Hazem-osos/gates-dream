/**
 * Unit checks: client/subcontractor extract journal lines balance to zero.
 */
import { contractingPostingService } from '../src/modules/contracting/services/contracting-posting.service';

const accounts = {
  clientReceivableAccountId: 'a1',
  retentionHeldByOthersAccountId: 'a2',
  customerAdvanceAccountId: 'a3',
  whtAssetAccountId: 'a4',
  penaltiesExpenseAccountId: 'a5',
  contractingRevenueAccountId: 'a6',
  outputVatAccountId: 'a7',
  projectExpenseAccountId: 'b1',
  inputVatAccountId: 'b2',
  subcontractorPayableAccountId: 'b3',
  retentionWithheldForOthersAccountId: 'b4',
  subcontractorAdvanceAccountId: 'b5',
  whtPayableAccountId: 'b6',
} as const;

function sumLines(lines: { debit: number; credit: number }[]) {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  return { debit: d, credit: c, diff: Math.round((d - c) * 10000) / 10000 };
}

const clientExtract = {
  id: 'x',
  extractNumber: 'CE-1',
  extractType: 'CLIENT',
  extractDate: new Date(),
  periodEnd: null,
  currentExecutedAmount: { toString: () => '100000' },
  advancePaymentDeduction: { toString: () => '5000' },
  retentionDeduction: { toString: () => '5000' },
  whtDeduction: { toString: () => '1000' },
  penalties: { toString: () => '0' },
  vatAmount: { toString: () => '12600' },
  netPayableAmount: { toString: () => '101600' },
  project: { costCenterId: 'cc1', id: 'p1', advancePaymentBalance: { toString: () => '50000' } },
  projectSubcontractId: null,
};

const clientLines = contractingPostingService.buildClientJournalLines(clientExtract, accounts);
const clientTotals = sumLines(clientLines);
if (clientTotals.diff !== 0) {
  console.error('Client extract JE not balanced', clientTotals);
  process.exit(1);
}

const subExtract = {
  ...clientExtract,
  extractType: 'SUBCONTRACTOR',
  projectSubcontractId: 'sub1',
  projectSubcontract: { id: 'sub1', advancePaymentBalance: { toString: () => '10000' } },
};

const subLines = contractingPostingService.buildSubcontractorJournalLines(subExtract, accounts);
const subTotals = sumLines(subLines);
if (subTotals.diff !== 0) {
  console.error('Subcontractor extract JE not balanced', subTotals);
  process.exit(1);
}

console.log('Contracting posting JE balance checks passed.');
console.log({ clientTotals, subTotals });
