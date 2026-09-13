import type { JournalEntryLineData } from '../types/journal-entry.types';
import type { ResolvedCompanyGlAccounts } from '../types/auto-gl-posting.types';

function line(
  accountId: string,
  debit: number,
  credit: number,
  lineOrder: number,
  description: string,
  extra?: Partial<JournalEntryLineData>
): JournalEntryLineData {
  return { accountId, debit, credit, lineOrder, description, ...extra };
}

export interface SalesInvoiceGlDraft {
  net: number;
  merchandise: number;
  tax: number;
  developmentFee?: number;
  cogs: number;
  isCash: boolean;
  customerId?: string | null;
  cashAccountId?: string | null;
  /** Personal customer AR account — never the company-wide control. */
  partyAccountId?: string | null;
}

export function buildSalesInvoiceLines(
  accounts: ResolvedCompanyGlAccounts,
  draft: SalesInvoiceGlDraft
): JournalEntryLineData[] {
  const party = draft.isCash
    ? draft.cashAccountId ?? accounts.cashAccountId
    : draft.partyAccountId ?? accounts.arAccountId;
  if (!party) throw new Error('Customer / cash account is not configured');
  if (!accounts.salesAccountId) throw new Error('Sales revenue account is not configured');

  const lines: JournalEntryLineData[] = [
    line(party, draft.net, 0, 1, 'AR / cash — sales invoice', {
      partnerId: draft.customerId ?? undefined,
      partnerType: draft.customerId ? 'CUSTOMER' : undefined,
    }),
    line(accounts.salesAccountId, 0, draft.merchandise, 2, 'Sales revenue'),
  ];
  if (draft.tax > 0) {
    if (!accounts.vatOutputAccountId) throw new Error('Output VAT account is not configured');
    lines.push(line(accounts.vatOutputAccountId, 0, draft.tax, 3, 'Output VAT'));
  }
  const developmentFee = draft.developmentFee ?? 0;
  if (developmentFee > 0) {
    const feeAccount = accounts.vatOutputAccountId ?? accounts.salesAccountId;
    if (!feeAccount) throw new Error('Development fee / sales account is not configured');
    lines.push(line(feeAccount, 0, developmentFee, 6, 'رسم التنمية'));
  }
  if (draft.cogs > 0) {
    if (!accounts.cogsAccountId || !accounts.inventoryAccountId) {
      throw new Error('COGS / inventory accounts are not configured');
    }
    lines.push(
      line(accounts.cogsAccountId, draft.cogs, 0, 4, 'COGS — perpetual'),
      line(accounts.inventoryAccountId, 0, draft.cogs, 5, 'Inventory — perpetual')
    );
  }
  return lines;
}

export interface PurchaseInvoiceGlDraft {
  net: number;
  merchandise: number;
  tax: number;
  developmentFee?: number;
  wht: number;
  isCash: boolean;
  supplierId?: string | null;
  cashAccountId?: string | null;
}

export function buildPurchaseInvoiceLines(
  accounts: ResolvedCompanyGlAccounts,
  draft: PurchaseInvoiceGlDraft
): JournalEntryLineData[] {
  if (!accounts.inventoryAccountId) throw new Error('Inventory account is not configured');
  const party = draft.isCash
    ? draft.cashAccountId ?? accounts.cashAccountId ?? accounts.bankAccountId
    : accounts.apAccountId;
  if (!party) throw new Error('Vendor / cash account is not configured');

  const lines: JournalEntryLineData[] = [
    line(accounts.inventoryAccountId, draft.merchandise, 0, 1, 'Inventory — purchase'),
  ];
  if (draft.tax > 0) {
    if (!accounts.vatInputAccountId) throw new Error('Input VAT account is not configured');
    lines.push(line(accounts.vatInputAccountId, draft.tax, 0, 2, 'Input VAT'));
  }
  const developmentFee = draft.developmentFee ?? 0;
  if (developmentFee > 0) {
    const feeAccount = accounts.vatInputAccountId ?? accounts.inventoryAccountId;
    lines.push(line(feeAccount, developmentFee, 0, 5, 'رسم التنمية'));
  }
  lines.push(
    line(party, 0, draft.net, 3, 'AP / cash — purchase invoice', {
      partnerId: draft.supplierId ?? undefined,
      partnerType: draft.supplierId ? 'SUPPLIER' : undefined,
    })
  );
  if (draft.wht > 0) {
    if (!accounts.withholdingAccountId) throw new Error('WHT account is not configured');
    lines.push(line(accounts.withholdingAccountId, 0, draft.wht, 4, 'Withholding tax'));
  }
  return lines;
}

export function buildTreasuryReceiptLines(params: {
  treasuryAccountId: string;
  counterpartAccountId: string;
  amount: number;
  partnerId?: string;
  partnerType?: 'CUSTOMER' | 'SUPPLIER';
  costCenterId?: string;
}): JournalEntryLineData[] {
  return [
    line(params.treasuryAccountId, params.amount, 0, 1, 'Treasury / bank — receipt', {
      costCenterId: params.costCenterId,
    }),
    line(params.counterpartAccountId, 0, params.amount, 2, 'Counterpart — receipt', {
      partnerId: params.partnerId,
      partnerType: params.partnerType,
      costCenterId: params.costCenterId,
    }),
  ];
}

export function buildTreasuryPaymentLines(params: {
  treasuryAccountId: string;
  counterpartAccountId: string;
  amount: number;
  partnerId?: string;
  partnerType?: 'CUSTOMER' | 'SUPPLIER';
  costCenterId?: string;
}): JournalEntryLineData[] {
  return [
    line(params.counterpartAccountId, params.amount, 0, 1, 'Counterpart — payment', {
      partnerId: params.partnerId,
      partnerType: params.partnerType,
      costCenterId: params.costCenterId,
    }),
    line(params.treasuryAccountId, 0, params.amount, 2, 'Treasury / bank — payment', {
      costCenterId: params.costCenterId,
    }),
  ];
}

export function buildContractorExtractPaymentLines(params: {
  contractorAccountId: string;
  treasuryAccountId: string;
  retentionAccountId?: string;
  advanceAccountId?: string;
  netPaid: number;
  retention: number;
  advance: number;
}): JournalEntryLineData[] {
  const gross = params.netPaid + params.retention + params.advance;
  const lines: JournalEntryLineData[] = [
    line(params.contractorAccountId, gross, 0, 1, 'Subcontractor account'),
    line(params.treasuryAccountId, 0, params.netPaid, 2, 'Net paid — treasury / bank'),
  ];
  if (params.retention > 0) {
    if (!params.retentionAccountId) throw new Error('Retention account is not configured');
    lines.push(
      line(params.retentionAccountId, 0, params.retention, 3, 'Business guarantee retention')
    );
  }
  if (params.advance > 0) {
    if (!params.advanceAccountId) throw new Error('Advance recovery account is not configured');
    lines.push(line(params.advanceAccountId, 0, params.advance, 4, 'Advance payment recovery'));
  }
  return lines;
}

export function buildChequeCollectLines(params: {
  bankAccountId: string;
  chequeAssetAccountId: string;
  amount: number;
}): JournalEntryLineData[] {
  return [
    line(params.bankAccountId, params.amount, 0, 1, 'Bank — cheque collect'),
    line(params.chequeAssetAccountId, 0, params.amount, 2, 'Cheques under collection'),
  ];
}

export function buildChequeBounceLines(params: {
  partyAccountId: string;
  chequeAssetAccountId: string;
  amount: number;
}): JournalEntryLineData[] {
  return [
    line(params.partyAccountId, params.amount, 0, 1, 'Party — cheque bounce'),
    line(params.chequeAssetAccountId, 0, params.amount, 2, 'Reverse cheque asset'),
  ];
}

export function buildChequeEndorseLines(params: {
  supplierAccountId: string;
  chequeAssetAccountId: string;
  amount: number;
}): JournalEntryLineData[] {
  return [
    line(params.supplierAccountId, params.amount, 0, 1, 'Supplier AP — endorse'),
    line(params.chequeAssetAccountId, 0, params.amount, 2, 'Cheques in portfolio'),
  ];
}
