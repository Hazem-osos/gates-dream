import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  sumPartnerNetOriginal,
  type PartyKind,
} from '../../accounting/services/party-ledger-balance.service';
import { contractingAccountResolverService } from '../services/contracting-account-resolver.service';
import { subcontractAccountResolverService } from '../../subcontracts/services/subcontract-account-resolver.service';

export type ContractingPartyReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'MISSING_PARTY'
  | 'MISSING_GL'
  | 'SETTLEMENT_MISMATCH';

export type ContractingPartyReconciliationReport = {
  certificateId: string;
  certificateKind: 'CLIENT_INVOICE' | 'SUBCONTRACT_INVOICE';
  partyType: PartyKind;
  partyId: string;
  certificateFinancialAmount: number;
  controlAccountId: string;
  glPartyLineAmount: number | null;
  glPartyPartnerId: string | null;
  partyAttributedJournalAmount: number | null;
  activeTreasurySettlementAmount: number;
  remainingSettlementAmount: number;
  statementDerivedOutstanding: number | null;
  status: ContractingPartyReconciliationStatus;
  details: string[];
};

const ACTIVE_CASH = { isPosted: true, isCancelled: false } as const;

function close(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

async function sumPartyControlLineOnJournal(
  companyId: string,
  journalEntryId: string,
  controlAccountId: string,
  expectedPartnerId: string,
  expectedPartnerType: PartyKind
) {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntryId,
      accountId: controlAccountId,
      journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
    },
    select: {
      partnerId: true,
      partnerType: true,
      debitBase: true,
      creditBase: true,
    },
  });
  if (!lines.length) return { amount: null as number | null, partnerId: null as string | null };

  let attributed = 0;
  let hasPartyLine = false;
  let partnerId: string | null = null;
  for (const line of lines) {
    const net = roundTo4(Number(line.debitBase) - Number(line.creditBase));
    if (line.partnerId && line.partnerType === expectedPartnerType) {
      hasPartyLine = true;
      partnerId = line.partnerId;
      if (line.partnerId === expectedPartnerId) {
        attributed = roundTo4(attributed + net);
      }
    } else if (!line.partnerId) {
      attributed = roundTo4(attributed + net);
    }
  }
  if (!hasPartyLine) {
    return { amount: roundTo4(lines.reduce((s, l) => s + Number(l.debitBase) - Number(l.creditBase), 0)), partnerId: null };
  }
  return { amount: attributed, partnerId };
}

async function sumPartyControlNetOnJournals(
  companyId: string,
  journalEntryIds: string[],
  controlAccountId: string,
  expectedPartnerId: string,
  expectedPartnerType: PartyKind
) {
  let total = 0;
  let partnerId: string | null = null;
  for (const journalEntryId of journalEntryIds) {
    const row = await sumPartyControlLineOnJournal(
      companyId,
      journalEntryId,
      controlAccountId,
      expectedPartnerId,
      expectedPartnerType
    );
    if (row.partnerId) partnerId = row.partnerId;
    if (row.amount != null) total = roundTo4(total + row.amount);
  }
  return { amount: total, partnerId };
}

function deriveReversedCertificateStatus(input: {
  reversalJournalEntryId: string | null;
  glPartyPartnerId: string | null;
  expectedPartyId: string;
  activeTreasurySettlementAmount: number;
  remainingSettlementAmount: number;
  netPartyControlAmount: number;
  certificateKind: 'CLIENT_INVOICE' | 'SUBCONTRACT_INVOICE';
}): { status: ContractingPartyReconciliationStatus; details: string[] } {
  const details: string[] = [];
  if (!input.reversalJournalEntryId) {
    details.push('Certificate is REVERSED but reversalJournalEntryId is missing');
    return { status: 'MISMATCH', details };
  }
  if (!input.glPartyPartnerId || input.glPartyPartnerId !== input.expectedPartyId) {
    details.push('Reversal journals missing expected party on control account');
    return { status: 'MISSING_PARTY', details };
  }
  if (input.activeTreasurySettlementAmount > 0.0001) {
    details.push('Reversed certificate still has active treasury settlements');
    return { status: 'SETTLEMENT_MISMATCH', details };
  }
  if (input.remainingSettlementAmount > 0.0001) {
    details.push('Reversed certificate remaining settlement should be zero');
    return { status: 'SETTLEMENT_MISMATCH', details };
  }
  if (!close(input.netPartyControlAmount, 0)) {
    details.push('Original plus reversal party control lines do not net to zero');
    return { status: 'MISMATCH', details };
  }
  return {
    status: 'MATCH',
    details: ['Reversed certificate: original and contra journals net party exposure to zero'],
  };
}

async function sumTreasuryPartyLinesForCertificate(
  companyId: string,
  certificateId: string,
  kind: 'CLIENT_INVOICE' | 'SUBCONTRACT_INVOICE',
  controlAccountId: string,
  partyId: string,
  partyType: PartyKind
) {
  const allocWhere =
    kind === 'CLIENT_INVOICE'
      ? { companyId, clientInvoiceId: certificateId, cashTransaction: ACTIVE_CASH }
      : { companyId, subcontractInvoiceId: certificateId, cashTransaction: ACTIVE_CASH };

  const allocations = await prisma.contractingCertificateAllocation.findMany({
    where: allocWhere,
    select: { cashTransactionId: true },
  });
  const cashIds = allocations.map((a) => a.cashTransactionId);
  if (!cashIds.length) return 0;

  const cashRows = await prisma.cashTransaction.findMany({
    where: { companyId, id: { in: cashIds }, ...ACTIVE_CASH },
    select: { journalEntryId: true },
  });
  const journalEntryIds = cashRows.map((c) => c.journalEntryId).filter((id): id is string => Boolean(id));
  if (!journalEntryIds.length) return 0;

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: controlAccountId,
      partnerId: partyId,
      partnerType: partyType,
      journalEntryId: { in: journalEntryIds },
    },
    select: { debitBase: true, creditBase: true },
  });

  return roundTo4(
    lines.reduce((sum, line) => sum + roundTo4(Number(line.debitBase) - Number(line.creditBase)), 0)
  );
}

function deriveStatus(input: {
  certificateKind: 'CLIENT_INVOICE' | 'SUBCONTRACT_INVOICE';
  hasJournal: boolean;
  glPartyPartnerId: string | null;
  expectedPartyId: string;
  certificateFinancialAmount: number;
  glPartyLineAmount: number | null;
  partyAttributedJournalAmount: number | null;
  activeTreasurySettlementAmount: number;
  remainingSettlementAmount: number;
  treasuryPartyNetOnControl: number;
}): { status: ContractingPartyReconciliationStatus; details: string[] } {
  const details: string[] = [];
  if (!input.hasJournal) {
    return { status: 'MISSING_GL', details: ['Certificate has no posted finance journal'] };
  }
  if (!input.glPartyPartnerId) {
    details.push('Control account line missing partner attribution');
    return { status: 'MISSING_PARTY', details };
  }
  if (input.glPartyPartnerId !== input.expectedPartyId) {
    details.push('Journal partner does not match certificate party');
    return { status: 'MISMATCH', details };
  }
  const attributed = input.partyAttributedJournalAmount ?? input.glPartyLineAmount;
  if (attributed == null || !close(attributed, input.certificateFinancialAmount)) {
    details.push('Party-attributed GL amount differs from certificate net liability');
    return { status: 'MISMATCH', details };
  }
  const settledMagnitude = roundTo4(Math.abs(input.treasuryPartyNetOnControl));
  if (!close(input.activeTreasurySettlementAmount, settledMagnitude)) {
    details.push('Active settlement total does not match treasury party journal movement');
    return { status: 'SETTLEMENT_MISMATCH', details };
  }
  const expectedRemaining =
    input.certificateKind === 'CLIENT_INVOICE'
      ? roundTo4(input.certificateFinancialAmount + input.treasuryPartyNetOnControl)
      : roundTo4(input.certificateFinancialAmount - input.treasuryPartyNetOnControl);
  if (!close(input.remainingSettlementAmount, Math.max(expectedRemaining, 0))) {
    details.push('Certificate remaining settlement differs from GL/treasury expectation');
    return { status: 'SETTLEMENT_MISMATCH', details };
  }
  return { status: 'MATCH', details: ['Party AR/AP, GL, settlement and remaining align'] };
}

export async function reconcileClientInvoicePartyAccounting(
  companyId: string,
  clientInvoiceId: string
): Promise<ContractingPartyReconciliationReport> {
  const invoice = await prisma.clientInvoice.findFirst({
    where: { id: clientInvoiceId, companyId },
    include: { clientContract: { select: { clientCustomerId: true } } },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المالك غير موجود');

  const partyId = invoice.clientContract.clientCustomerId;
  const accounts = await contractingAccountResolverService.resolveAccounts(companyId);
  const certificateFinancialAmount = roundTo4(Number(invoice.netPayableByClient));
  const remainingSettlementAmount = roundTo4(Number(invoice.remainingSettlementAmount ?? 0));

  const activeAgg = await prisma.contractingCertificateAllocation.aggregate({
    where: {
      companyId,
      clientInvoiceId,
      cashTransaction: ACTIVE_CASH,
    },
    _sum: { allocatedAmount: true },
  });
  const activeTreasurySettlementAmount = roundTo4(Number(activeAgg._sum.allocatedAmount ?? 0));

  if (invoice.status === 'REVERSED') {
    const journalIds = [invoice.journalEntryId, invoice.reversalJournalEntryId].filter(
      (id): id is string => Boolean(id)
    );
    const glRev = await sumPartyControlNetOnJournals(
      companyId,
      journalIds,
      accounts.clientReceivableAccountId,
      partyId,
      'CUSTOMER'
    );
    const { status, details } = deriveReversedCertificateStatus({
      reversalJournalEntryId: invoice.reversalJournalEntryId,
      glPartyPartnerId: glRev.partnerId,
      expectedPartyId: partyId,
      activeTreasurySettlementAmount,
      remainingSettlementAmount,
      netPartyControlAmount: glRev.amount,
      certificateKind: 'CLIENT_INVOICE',
    });
    return {
      certificateId: clientInvoiceId,
      certificateKind: 'CLIENT_INVOICE',
      partyType: 'CUSTOMER',
      partyId,
      certificateFinancialAmount,
      controlAccountId: accounts.clientReceivableAccountId,
      glPartyLineAmount: glRev.amount,
      glPartyPartnerId: glRev.partnerId,
      partyAttributedJournalAmount: glRev.amount,
      activeTreasurySettlementAmount,
      remainingSettlementAmount,
      statementDerivedOutstanding: await sumPartnerNetOriginal(
        prisma,
        companyId,
        partyId,
        'CUSTOMER'
      ),
      status,
      details,
    };
  }

  const gl =
    invoice.journalEntryId != null
      ? await sumPartyControlLineOnJournal(
          companyId,
          invoice.journalEntryId,
          accounts.clientReceivableAccountId,
          partyId,
          'CUSTOMER'
        )
      : { amount: null, partnerId: null };

  const treasuryPartyNet = invoice.journalEntryId
    ? await sumTreasuryPartyLinesForCertificate(
        companyId,
        clientInvoiceId,
        'CLIENT_INVOICE',
        accounts.clientReceivableAccountId,
        partyId,
        'CUSTOMER'
      )
    : 0;

  const statementDerivedOutstanding = await sumPartnerNetOriginal(
    prisma,
    companyId,
    partyId,
    'CUSTOMER'
  );

  const { status, details } = deriveStatus({
    certificateKind: 'CLIENT_INVOICE',
    hasJournal: Boolean(invoice.journalEntryId),
    glPartyPartnerId: gl.partnerId,
    expectedPartyId: partyId,
    certificateFinancialAmount,
    glPartyLineAmount: gl.amount,
    partyAttributedJournalAmount: gl.amount,
    activeTreasurySettlementAmount,
    remainingSettlementAmount,
    treasuryPartyNetOnControl: treasuryPartyNet,
  });

  return {
    certificateId: clientInvoiceId,
    certificateKind: 'CLIENT_INVOICE',
    partyType: 'CUSTOMER',
    partyId,
    certificateFinancialAmount,
    controlAccountId: accounts.clientReceivableAccountId,
    glPartyLineAmount: gl.amount,
    glPartyPartnerId: gl.partnerId,
    partyAttributedJournalAmount: gl.amount,
    activeTreasurySettlementAmount,
    remainingSettlementAmount,
    statementDerivedOutstanding,
    status,
    details,
  };
}

export async function reconcileSubcontractInvoicePartyAccounting(
  companyId: string,
  subcontractInvoiceId: string
): Promise<ContractingPartyReconciliationReport> {
  const invoice = await prisma.subcontractInvoice.findFirst({
    where: { id: subcontractInvoiceId, companyId },
    include: { subcontract: { select: { subcontractorId: true } } },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المقاول غير موجود');

  const partyId = invoice.subcontract.subcontractorId;
  const accounts = await subcontractAccountResolverService.resolveAccounts(companyId);
  const certificateFinancialAmount = roundTo4(Number(invoice.netPayableAmount));
  const remainingSettlementAmount = roundTo4(Number(invoice.remainingSettlementAmount ?? 0));

  const activeAgg = await prisma.contractingCertificateAllocation.aggregate({
    where: {
      companyId,
      subcontractInvoiceId,
      cashTransaction: ACTIVE_CASH,
    },
    _sum: { allocatedAmount: true },
  });
  const activeTreasurySettlementAmount = roundTo4(Number(activeAgg._sum.allocatedAmount ?? 0));

  if (invoice.status === 'REVERSED') {
    const journalIds = [invoice.journalEntryId, invoice.reversalJournalEntryId].filter(
      (id): id is string => Boolean(id)
    );
    const glRev = await sumPartyControlNetOnJournals(
      companyId,
      journalIds,
      accounts.apAccountId,
      partyId,
      'SUBCONTRACTOR'
    );
    const apNet = roundTo4(-glRev.amount);
    const { status, details } = deriveReversedCertificateStatus({
      reversalJournalEntryId: invoice.reversalJournalEntryId,
      glPartyPartnerId: glRev.partnerId,
      expectedPartyId: partyId,
      activeTreasurySettlementAmount,
      remainingSettlementAmount,
      netPartyControlAmount: glRev.amount,
      certificateKind: 'SUBCONTRACT_INVOICE',
    });
    return {
      certificateId: subcontractInvoiceId,
      certificateKind: 'SUBCONTRACT_INVOICE',
      partyType: 'SUBCONTRACTOR',
      partyId,
      certificateFinancialAmount,
      controlAccountId: accounts.apAccountId,
      glPartyLineAmount: apNet,
      glPartyPartnerId: glRev.partnerId,
      partyAttributedJournalAmount: apNet,
      activeTreasurySettlementAmount,
      remainingSettlementAmount,
      statementDerivedOutstanding: await sumPartnerNetOriginal(
        prisma,
        companyId,
        partyId,
        'SUBCONTRACTOR'
      ),
      status,
      details,
    };
  }

  const gl =
    invoice.journalEntryId != null
      ? await sumPartyControlLineOnJournal(
          companyId,
          invoice.journalEntryId,
          accounts.apAccountId,
          partyId,
          'SUBCONTRACTOR'
        )
      : { amount: null, partnerId: null };

  const treasuryPartyNet = invoice.journalEntryId
    ? await sumTreasuryPartyLinesForCertificate(
        companyId,
        subcontractInvoiceId,
        'SUBCONTRACT_INVOICE',
        accounts.apAccountId,
        partyId,
        'SUBCONTRACTOR'
      )
    : 0;

  const statementDerivedOutstanding = await sumPartnerNetOriginal(
    prisma,
    companyId,
    partyId,
    'SUBCONTRACTOR'
  );

  const apGlAmount = gl.amount != null ? roundTo4(-gl.amount) : null;

  const { status, details } = deriveStatus({
    certificateKind: 'SUBCONTRACT_INVOICE',
    hasJournal: Boolean(invoice.journalEntryId),
    glPartyPartnerId: gl.partnerId,
    expectedPartyId: partyId,
    certificateFinancialAmount,
    glPartyLineAmount: apGlAmount,
    partyAttributedJournalAmount: apGlAmount,
    activeTreasurySettlementAmount,
    remainingSettlementAmount,
    treasuryPartyNetOnControl: treasuryPartyNet,
  });

  return {
    certificateId: subcontractInvoiceId,
    certificateKind: 'SUBCONTRACT_INVOICE',
    partyType: 'SUBCONTRACTOR',
    partyId,
    certificateFinancialAmount,
    controlAccountId: accounts.apAccountId,
    glPartyLineAmount: apGlAmount,
    glPartyPartnerId: gl.partnerId,
    partyAttributedJournalAmount: apGlAmount,
    activeTreasurySettlementAmount,
    remainingSettlementAmount,
    statementDerivedOutstanding,
    status,
    details,
  };
}

/** Read-only audit: posted canonical certificates whose control line lacks partnerId. */
export async function auditPostedCertificatesMissingPartyAttribution(companyId: string) {
  const [clientInvoices, subInvoices] = await Promise.all([
    prisma.clientInvoice.findMany({
      where: { companyId, journalEntryId: { not: null }, status: { in: ['FINANCE_POSTED', 'PAID'] } },
      select: { id: true, journalEntryId: true, invoiceNumber: true },
    }),
    prisma.subcontractInvoice.findMany({
      where: { companyId, journalEntryId: { not: null }, status: { in: ['FINANCE_POSTED', 'PAID'] } },
      select: { id: true, journalEntryId: true, invoiceNumber: true },
    }),
  ]);

  const accounts = await contractingAccountResolverService.resolveAccounts(companyId);
  const subAccounts = await subcontractAccountResolverService.resolveAccounts(companyId);

  const missing: Array<{ kind: string; id: string; invoiceNumber: string; journalEntryId: string }> = [];

  for (const row of clientInvoices) {
    if (!row.journalEntryId) continue;
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: row.journalEntryId, accountId: accounts.clientReceivableAccountId },
      select: { partnerId: true },
    });
    if (lines.some((l) => !l.partnerId)) {
      missing.push({
        kind: 'CLIENT_INVOICE',
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        journalEntryId: row.journalEntryId,
      });
    }
  }

  for (const row of subInvoices) {
    if (!row.journalEntryId) continue;
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: row.journalEntryId, accountId: subAccounts.apAccountId },
      select: { partnerId: true },
    });
    if (lines.some((l) => !l.partnerId)) {
      missing.push({
        kind: 'SUBCONTRACT_INVOICE',
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        journalEntryId: row.journalEntryId,
      });
    }
  }

  return missing;
}

export const contractingPartyReconciliationService = {
  reconcileClientInvoicePartyAccounting,
  reconcileSubcontractInvoicePartyAccounting,
  auditPostedCertificatesMissingPartyAttribution,
};
