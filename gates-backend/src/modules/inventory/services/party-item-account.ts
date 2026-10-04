import { JournalSourceType } from '@prisma/client';
import { resolveJournalSourceKind } from '../../accounting/utils/journal-source';
import prisma from '../../../shared/database/prisma';

function cashVoucherPresentation(
  row: { bankAccountId?: string | null; voucherFamily?: string | null },
  kind: 'RECEIPT' | 'PAYMENT'
) {
  const bank =
    Boolean(row.bankAccountId) ||
    row.voucherFamily === 'BANK' ||
    row.voucherFamily === 'KP01' ||
    row.voucherFamily === 'KR01' ||
    row.voucherFamily === 'ORDPB' ||
    row.voucherFamily === 'ORDRB';
  const label =
    kind === 'PAYMENT'
      ? bank
        ? 'إشعار خصم بنكي'
        : 'سند صرف'
      : bank
        ? 'إشعار إضافة بنكي'
        : 'سند قبض';
  const path = bank
    ? kind === 'PAYMENT'
      ? '/accounting/operations/banks/bank-discount'
      : '/accounting/operations/banks/bank-addition'
    : kind === 'PAYMENT'
      ? '/accounting/operations/treasury/payment-voucher'
      : '/accounting/operations/treasury/receipt-voucher';
  return {
    label,
    href: (cashTransactionId?: string | null) =>
      cashTransactionId ? `${path}?id=${encodeURIComponent(cashTransactionId)}` : path,
  };
}

export type PartyItemDraft = {
  partyId: string;
  partyCode: string;
  partyName: string;
  date: string;
  invoiceNumber: string;
  description: string;
  itemName: string;
  itemGroupName: string;
  itemCategoryName: string;
  unitName: string;
  quantity: number | null;
  unitPrice: number | null;
  /** Row amount inside the invoice, after discount and including tax. */
  lineInclusiveValue?: number | null;
  debit: number;
  credit: number;
  invoiceId?: string;
  invoiceKind?: string | null;
  invoiceType?: string | null;
  invoicePreviewPath?: string;
  journalEntryId?: string;
};

export type PartyOpening = {
  partyId: string;
  partyCode: string;
  partyName: string;
  /** Positive is a debit balance. */
  amount: number;
};

export type PartyItemRow = {
  id: string;
  groupKey: string;
  accountPath: string;
  partyCode: string;
  partyName: string;
  rowKind: 'opening' | 'movement' | 'total';
  date: string | null;
  invoiceNumber: string;
  description: string;
  itemName: string;
  itemGroupName: string;
  itemCategoryName: string;
  unitName: string;
  quantity: number | null;
  unitPrice: number | null;
  lineInclusiveValue: number | null;
  debit: number;
  credit: number;
  runningBalance: number;
  invoiceId?: string;
  invoiceKind?: string | null;
  invoiceType?: string | null;
  invoicePreviewPath?: string;
  journalEntryId?: string;
};

const DOCUMENT_JOURNAL_KINDS = new Set<JournalSourceType>([
  JournalSourceType.SALES_INVOICE,
  JournalSourceType.SALES_RETURN,
  JournalSourceType.PURCHASE_INVOICE,
  JournalSourceType.PURCHASE_RETURN,
  JournalSourceType.RECEIPT_VOUCHER,
  JournalSourceType.PAYMENT_VOUCHER,
  JournalSourceType.SECURITIES_RECEIPT,
  JournalSourceType.SECURITIES_PAYMENT,
  JournalSourceType.CHEQUE_ENDORSEMENT,
  JournalSourceType.STOCK_TRANSACTION,
]);

export function journalMovementLabel(sourceType?: string | null, description?: string | null): string {
  const text = String(description ?? '').trim();
  const source = String(sourceType ?? '').trim().toUpperCase();
  if (source === 'COUNTERPARTY_OFFSET' || /تسوية|مقاصة/.test(text)) {
    return text || 'تسوية مقاصة';
  }
  return text || 'قيد يومية';
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function partyBanner(label: string, code: string, name: string): string {
  return [label, code, name].map((part) => part.trim()).filter(Boolean).join('   ');
}

export function buildPartyItemStatement(
  drafts: PartyItemDraft[],
  openings: PartyOpening[],
  opts: { partyLabel: string; fromDate?: string | null; page: number; limit: number }
) {
  const parties = new Map<string, { code: string; name: string; rows: PartyItemDraft[] }>();
  const touch = (id: string, code: string, name: string) => {
    const current = parties.get(id);
    if (!current) {
      parties.set(id, { code, name, rows: [] });
      return;
    }
    if (!current.code && code) current.code = code;
    if (!current.name && name) current.name = name;
  };

  for (const opening of openings) touch(opening.partyId, opening.partyCode, opening.partyName);
  const sorted = drafts
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const byDate = a.row.date.localeCompare(b.row.date);
      return byDate || a.index - b.index;
    })
    .map((entry) => entry.row);
  for (const row of sorted) {
    touch(row.partyId, row.partyCode, row.partyName);
    parties.get(row.partyId)!.rows.push(row);
  }

  const orderedParties = [...parties.entries()].sort((a, b) =>
    (a[1].name || a[1].code).localeCompare(b[1].name || b[1].code, 'ar')
  );
  const openingByParty = new Map(openings.map((row) => [row.partyId, row.amount]));
  const rows: PartyItemRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const [partyId, party] of orderedParties) {
    const opening = round2(openingByParty.get(partyId) || 0);
    const banner = partyBanner(opts.partyLabel, party.code, party.name);
    let running = opening;
    let partyDebit = 0;
    let partyCredit = 0;
    if (opts.fromDate && (opening !== 0 || party.rows.length > 0)) {
      rows.push({
        id: `${partyId}:opening`,
        groupKey: partyId,
        accountPath: banner,
        partyCode: party.code,
        partyName: party.name,
        rowKind: 'opening',
        date: opts.fromDate,
        invoiceNumber: '',
        description: 'رصيد افتتاحي',
        itemName: '',
        itemGroupName: '',
        itemCategoryName: '',
        unitName: '',
        quantity: null,
        unitPrice: null,
        lineInclusiveValue: null,
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? round2(-opening) : 0,
        runningBalance: opening,
      });
    }
    for (const [index, movement] of party.rows.entries()) {
      const debit = round2(Math.max(movement.debit, 0));
      const credit = round2(Math.max(movement.credit, 0));
      running = round2(running + debit - credit);
      partyDebit = round2(partyDebit + debit);
      partyCredit = round2(partyCredit + credit);
      totalDebit = round2(totalDebit + debit);
      totalCredit = round2(totalCredit + credit);
      rows.push({
        id: `${partyId}:${movement.date}:${movement.invoiceNumber}:${index}`,
        groupKey: partyId,
        accountPath: banner,
        partyCode: party.code,
        partyName: party.name,
        rowKind: 'movement',
        date: movement.date,
        invoiceNumber: movement.invoiceNumber,
        description: movement.description,
        itemName: movement.itemName,
        itemGroupName: movement.itemGroupName,
        itemCategoryName: movement.itemCategoryName,
        unitName: movement.unitName,
        quantity: movement.quantity,
        unitPrice: movement.unitPrice,
        lineInclusiveValue: movement.lineInclusiveValue ?? null,
        debit,
        credit,
        runningBalance: running,
        invoiceId: movement.invoiceId,
        invoiceKind: movement.invoiceKind,
        invoiceType: movement.invoiceType,
        invoicePreviewPath: movement.invoicePreviewPath,
        journalEntryId: movement.journalEntryId,
      });
    }
    if (party.rows.length > 0 || (opts.fromDate && opening !== 0)) {
      rows.push({
        id: `${partyId}:total`,
        groupKey: partyId,
        accountPath: banner,
        partyCode: party.code,
        partyName: party.name,
        rowKind: 'total',
        date: null,
        invoiceNumber: '',
        description: 'الإجمالي',
        itemName: '',
        itemGroupName: '',
        itemCategoryName: '',
        unitName: '',
        quantity: null,
        unitPrice: null,
        lineInclusiveValue: null,
        debit: partyDebit,
        credit: partyCredit,
        runningBalance: running,
      });
    }
  }

  const openingTotal = round2([...openingByParty.values()].reduce((sum, amount) => sum + amount, 0));
  const start = Math.max(opts.page - 1, 0) * opts.limit;
  return {
    data: rows.slice(start, start + opts.limit),
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: round2(openingTotal + totalDebit - totalCredit),
      partyCount: orderedParties.length,
    },
    pagination: {
      page: opts.page,
      limit: opts.limit,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / opts.limit)),
    },
  };
}

type PartySide = 'customer' | 'supplier';

type PartyFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  customerId?: string;
  supplierId?: string;
  customerCategoryId?: string;
  supplierCategoryId?: string;
  itemId?: string;
  branchId?: string;
  userId?: string;
  showUnposted?: boolean;
};

const PARTY_SELECT = {
  id: true,
  code: true,
  arabicName: true,
  accountId: true,
  mainAccountId: true,
  mainAccount: { select: { code: true } },
} as const;

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cashVoucherPostedFilter(showUnposted?: boolean) {
  if (showUnposted) return {};
  return { isPosted: true };
}

function partyIdentity(party: { code?: string | null; arabicName?: string | null; mainAccount?: { code?: string | null } | null } | null) {
  return {
    code: party?.mainAccount?.code || party?.code || '',
    name: party?.arabicName || '',
  };
}

/** Qty × price, minus line and header discount, plus tax, minus withholding. */
export function lineInclusiveValue(line: {
  total: unknown;
  discountAmount?: unknown;
  taxAmount?: unknown;
  headerDiscountAllocated?: unknown;
  withholdingTaxAmount?: unknown;
}): number {
  return round2(
    money(line.total) -
      money(line.discountAmount) -
      money(line.headerDiscountAllocated) +
      money(line.taxAmount) -
      money(line.withholdingTaxAmount)
  );
}

/**
 * Each item row keeps its own inclusive value. The invoice's final amount
 * is posted once, on the last row. Earlier rows post 0.
 */
export function invoiceLineLedger(
  lines: Array<{ inclusive: number }>,
  invoiceNet: number,
  itemOnly: boolean
): Array<{ lineInclusiveValue: number; ledgerAmount: number }> {
  const net = round2(Math.abs(invoiceNet));
  if (!lines.length) return [];
  return lines.map((line, index) => {
    const inclusive = round2(line.inclusive);
    const last = index === lines.length - 1;
    const ledgerAmount = itemOnly
      ? Math.abs(inclusive)
      : last
        ? net
        : 0;
    return {
      lineInclusiveValue: inclusive,
      ledgerAmount,
    };
  });
}

function isCustomerReturn(kind: string | null, type: string | null): boolean {
  if (kind === 'SALE_RETURN') return true;
  if (kind) return false;
  return type === 'salesReturn' || type === 'return';
}

function isSupplierReturn(kind: string | null, type: string | null): boolean {
  if (kind === 'PURCHASE_RETURN') return true;
  if (kind) return false;
  return type === 'purchaseReturn' || type === 'return';
}

export async function loadPartyItemAccount(
  filters: PartyFilters,
  options: { page?: number; limit?: number },
  party: PartySide
) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 2000;
  const posted = filters.showUnposted ? {} : { isPosted: true };
  const itemOnly = Boolean(filters.itemId);
  const partyId = party === 'customer' ? filters.customerId : filters.supplierId;
  const categoryId = party === 'customer' ? filters.customerCategoryId : filters.supplierCategoryId;

  const periodDate =
    filters.fromDate || filters.toDate
      ? {
          ...(filters.fromDate ? { gte: filters.fromDate } : {}),
          ...(filters.toDate ? { lte: filters.toDate } : {}),
        }
      : undefined;
  const priorDate = filters.fromDate ? { lt: filters.fromDate } : undefined;

  const drafts = await collectPartyItems(filters, party, posted, periodDate, itemOnly, partyId, categoryId);
  const openings = priorDate
    ? foldOpenings(await collectPartyItems(filters, party, posted, priorDate, itemOnly, partyId, categoryId))
    : [];

  return buildPartyItemStatement(drafts, openings, {
    partyLabel: party === 'customer' ? 'العميل' : 'المورد',
    fromDate: filters.fromDate ? filters.fromDate.toISOString() : null,
    page,
    limit,
  });
}

function foldOpenings(drafts: PartyItemDraft[]): PartyOpening[] {
  const map = new Map<string, PartyOpening>();
  for (const row of drafts) {
    const current = map.get(row.partyId) ?? {
      partyId: row.partyId,
      partyCode: row.partyCode,
      partyName: row.partyName,
      amount: 0,
    };
    current.amount = round2(current.amount + row.debit - row.credit);
    if (!current.partyCode) current.partyCode = row.partyCode;
    if (!current.partyName) current.partyName = row.partyName;
    map.set(row.partyId, current);
  }
  return [...map.values()];
}

async function collectPartyItems(
  filters: PartyFilters,
  party: PartySide,
  posted: { isPosted?: boolean },
  date: { gte?: Date; lte?: Date; lt?: Date } | undefined,
  itemOnly: boolean,
  partyId: string | undefined,
  categoryId: string | undefined
): Promise<PartyItemDraft[]> {
  const companyId = filters.companyId;
  const branch = filters.branchId ? { branchId: filters.branchId } : {};
  const dated = date ? { date } : {};
  const kinds = party === 'customer' ? ['SALE', 'SALE_RETURN'] : ['PURCHASE', 'PURCHASE_RETURN'];
  const types = party === 'customer' ? ['sales', 'salesReturn', 'return'] : ['purchase', 'purchaseReturn', 'return'];
  const partyScalar = party === 'customer' ? { customerId: partyId } : { supplierId: partyId };
  const partyPresent = party === 'customer' ? { customerId: { not: null } } : { supplierId: { not: null } };
  const partyWhere = partyId ? partyScalar : partyPresent;
  const categoryWhere = categoryId
    ? party === 'customer'
      ? { customer: { customerCategoryId: categoryId } }
      : { supplier: { supplierCategoryId: categoryId } }
    : {};

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      isCancelled: false,
      ...posted,
      ...branch,
      ...dated,
      ...partyWhere,
      ...categoryWhere,
      ...(filters.userId ? { createdBy: filters.userId } : {}),
      ...(filters.itemId ? { lines: { some: { itemId: filters.itemId } } } : {}),
      OR: [{ invoiceKind: { in: kinds } }, { AND: [{ invoiceKind: null }, { invoiceType: { in: types } }] }],
    },
    orderBy: [{ date: 'asc' }, { invoiceNumber: 'asc' }],
    take: 5000,
    include: {
      customer: { select: PARTY_SELECT },
      supplier: { select: PARTY_SELECT },
      lines: {
        where: filters.itemId ? { itemId: filters.itemId } : undefined,
        orderBy: { lineOrder: 'asc' },
        include: {
          unit: { select: { arabicName: true } },
          item: {
            select: {
              arabicName: true,
              category: {
                select: {
                  arabicName: true,
                  parentCategory: { select: { arabicName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const drafts: PartyItemDraft[] = [];
  for (const invoice of invoices) {
    const owner = party === 'customer' ? invoice.customer : invoice.supplier;
    const id = party === 'customer' ? invoice.customerId : invoice.supplierId;
    if (!id || !owner) continue;
    const identity = partyIdentity(owner);
    const returned = party === 'customer'
      ? isCustomerReturn(invoice.invoiceKind, invoice.invoiceType)
      : isSupplierReturn(invoice.invoiceKind, invoice.invoiceType);
    const description = invoice.description?.trim() || (returned
      ? party === 'customer' ? 'مردود مبيعات' : 'مردود مشتريات'
      : party === 'customer' ? 'فاتورة مبيعات' : 'فاتورة مشتريات');
    const date = invoice.date.toISOString();
    const number = invoice.invoiceNumber || '';
    const preview = invoicePreviewPath(party, invoice.invoiceKind, invoice.invoiceType, invoice.id);
    const net = money(invoice.netAmount || invoice.totalAmount);
    if (!invoice.lines.length && !itemOnly) {
      const amount = money(invoice.netAmount || invoice.totalAmount);
      const debitSide = party === 'customer' ? !returned : returned;
      drafts.push({
        partyId: id,
        partyCode: identity.code,
        partyName: identity.name,
        date,
        invoiceNumber: number,
        description,
        itemName: '',
        itemGroupName: '',
        itemCategoryName: '',
        unitName: '',
        quantity: null,
        unitPrice: null,
        lineInclusiveValue: null,
        invoiceId: invoice.id,
        invoiceKind: invoice.invoiceKind,
        invoiceType: invoice.invoiceType,
        invoicePreviewPath: preview,
        ...(debitSide ? { debit: amount, credit: 0 } : { debit: 0, credit: amount }),
      });
      continue;
    }
    const ledger = invoiceLineLedger(
      invoice.lines.map((line) => ({ inclusive: lineInclusiveValue(line) })),
      net,
      itemOnly
    );
    const debitSide = party === 'customer' ? !returned : returned;
    invoice.lines.forEach((line, index) => {
      const amount = ledger[index]?.ledgerAmount ?? 0;
      drafts.push({
        partyId: id,
        partyCode: identity.code,
        partyName: identity.name,
        date,
        invoiceNumber: number,
        description,
        itemName: line.item?.arabicName || '',
        itemGroupName: line.item?.category?.arabicName || '',
        itemCategoryName: '',
        unitName: line.unit?.arabicName || '',
        quantity: money(line.quantity),
        unitPrice: money(line.price),
        lineInclusiveValue: ledger[index]?.lineInclusiveValue ?? 0,
        invoiceId: invoice.id,
        invoiceKind: invoice.invoiceKind,
        invoiceType: invoice.invoiceType,
        invoicePreviewPath: preview,
        ...(debitSide ? { debit: amount, credit: 0 } : { debit: 0, credit: amount }),
      });
    });
  }

  if (itemOnly) return drafts;

  const cashCategoryWhere = categoryId
    ? party === 'customer'
      ? { customer: { customerCategoryId: categoryId } }
      : { supplier: { supplierCategoryId: categoryId } }
    : {};

  const cashTransactions = await prisma.cashTransaction.findMany({
    where: {
      companyId,
      isCancelled: false,
      ...cashVoucherPostedFilter(filters.showUnposted),
      ...branch,
      ...dated,
      ...partyWhere,
      ...cashCategoryWhere,
      transactionKind: { in: ['RECEIPT', 'PAYMENT'] },
    },
    orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
    take: 5000,
    include: {
      customer: { select: PARTY_SELECT },
      supplier: { select: PARTY_SELECT },
    },
  });

  const [legacyReceipts, legacyPayments, securityReceipts, securityPayments] = await Promise.all([
    prisma.treasuryReceipt.findMany({
      where: {
        companyId,
        isCancelled: false,
        ...(filters.showUnposted ? {} : { isPosted: true }),
        cashTransaction: { is: null },
        ...branch,
        ...dated,
        ...partyWhere,
        ...categoryWhere,
      },
      orderBy: { date: 'asc' },
      take: 5000,
      include: {
        customer: { select: PARTY_SELECT },
        supplier: { select: PARTY_SELECT },
      },
    }),
    prisma.treasuryPayment.findMany({
      where: {
        companyId,
        isCancelled: false,
        ...(filters.showUnposted ? {} : { isPosted: true }),
        cashTransaction: { is: null },
        ...branch,
        ...dated,
        ...partyWhere,
        ...categoryWhere,
      },
      orderBy: { date: 'asc' },
      take: 5000,
      include: {
        customer: { select: PARTY_SELECT },
        supplier: { select: PARTY_SELECT },
      },
    }),
    prisma.securitiesReceipt.findMany({
      where: { companyId, isCancelled: false, ...posted, ...branch, ...dated, ...partyWhere, ...categoryWhere },
      orderBy: { date: 'asc' },
      take: 5000,
      include: { customer: { select: PARTY_SELECT }, supplier: { select: PARTY_SELECT } },
    }),
    prisma.securitiesPayment.findMany({
      where: { companyId, isCancelled: false, ...posted, ...branch, ...dated, ...partyWhere, ...categoryWhere },
      orderBy: { date: 'asc' },
      take: 5000,
      include: { customer: { select: PARTY_SELECT }, supplier: { select: PARTY_SELECT } },
    }),
  ]);

  const pushMoney = (
    owner: { id: string; code?: string | null; arabicName?: string | null; mainAccount?: { code?: string | null } | null } | null,
    id: string | null,
    date: Date,
    number: string,
    description: string,
    amount: number,
    debitSide: boolean,
    previewPath?: string
  ) => {
    if (!id || !owner || amount === 0) return;
    const identity = partyIdentity(owner);
    drafts.push({
      partyId: id,
      partyCode: identity.code,
      partyName: identity.name,
      date: date.toISOString(),
      invoiceNumber: number,
      description,
      itemName: '',
      itemGroupName: '',
      itemCategoryName: '',
      unitName: '',
      quantity: null,
      unitPrice: null,
      invoicePreviewPath: previewPath,
      ...(debitSide ? { debit: round2(amount), credit: 0 } : { debit: 0, credit: round2(amount) }),
    });
  };

  for (const row of legacyReceipts) {
    const owner = party === 'customer' ? row.customer : row.supplier;
    const id = party === 'customer' ? row.customerId : row.supplierId;
    const doc = cashVoucherPresentation(row, 'RECEIPT');
    pushMoney(
      owner,
      id,
      row.date,
      row.voucherNumber || row.serial || '',
      row.description?.trim() || doc.label,
      money(row.amount),
      false,
      doc.href(undefined)
    );
  }
  for (const row of legacyPayments) {
    const owner = party === 'customer' ? row.customer : row.supplier;
    const id = party === 'customer' ? row.customerId : row.supplierId;
    const doc = cashVoucherPresentation(row, 'PAYMENT');
    pushMoney(
      owner,
      id,
      row.date,
      row.voucherNumber || row.serial || '',
      row.description?.trim() || doc.label,
      money(row.amount),
      true,
      doc.href(undefined)
    );
  }
  for (const row of cashTransactions) {
    const isReceipt = row.transactionKind === 'RECEIPT';
    const owner = party === 'customer' ? row.customer : row.supplier;
    const id = party === 'customer' ? row.customerId : row.supplierId;
    const doc = cashVoucherPresentation(
      { bankAccountId: row.bankAccountId, voucherFamily: row.bankAccountId ? 'BANK' : 'CASH' },
      isReceipt ? 'RECEIPT' : 'PAYMENT'
    );
    const debitSide = !isReceipt;
    pushMoney(
      owner,
      id,
      row.date,
      row.voucherNumber || '',
      row.description?.trim() || doc.label,
      money(row.amount),
      debitSide,
      doc.href(row.id)
    );
  }
  for (const row of securityReceipts) {
    const owner = party === 'customer' ? row.customer : row.supplier;
    const id = party === 'customer' ? row.customerId : row.supplierId;
    pushMoney(
      owner,
      id,
      row.date,
      row.receiptNumber || row.serial || row.securityNumber || '',
      row.description?.trim() || 'تحصيل ورقة قبض',
      money(row.amount),
      false,
      `/accounting/operations/securities/receipt?id=${encodeURIComponent(row.id)}`
    );
  }
  for (const row of securityPayments) {
    const owner = party === 'customer' ? row.customer : row.supplier;
    const id = party === 'customer' ? row.customerId : row.supplierId;
    pushMoney(
      owner,
      id,
      row.date,
      row.paymentNumber || row.serial || row.securityNumber || '',
      row.description?.trim() || 'ورقة دفع',
      money(row.amount),
      true,
      `/accounting/operations/securities/payment?id=${encodeURIComponent(row.id)}`
    );
  }

  await collectPartyJournals(drafts, filters, party, posted, date, partyId, categoryId);

  return drafts;
}

function invoicePreviewPath(
  party: PartySide,
  kind: string | null,
  type: string | null,
  invoiceId: string
): string {
  const q = encodeURIComponent(invoiceId);
  if (party === 'customer') {
    return isCustomerReturn(kind, type)
      ? `/inventory/operations/sales-returns?invoiceId=${q}`
      : `/inventory/operations/sales-invoice?invoiceId=${q}`;
  }
  return isSupplierReturn(kind, type)
    ? `/inventory/operations/purchase-returns?invoiceId=${q}`
    : `/inventory/operations/final-purchase-invoice?invoiceId=${q}`;
}

function uniquePartyAccounts(
  parties: Array<{ id: string; accountId?: string | null; mainAccountId?: string | null }>
): Map<string, string> {
  const owners = new Map<string, string[]>();
  for (const party of parties) {
    const accounts = [...new Set([party.accountId, party.mainAccountId].filter(Boolean))] as string[];
    for (const accountId of accounts) {
      const current = owners.get(accountId) ?? [];
      current.push(party.id);
      owners.set(accountId, current);
    }
  }
  const map = new Map<string, string>();
  for (const [accountId, ids] of owners) {
    if (ids.length === 1) map.set(accountId, ids[0]);
  }
  return map;
}

type PartyMaster = {
  id: string;
  code: string | null;
  arabicName: string | null;
  accountId: string | null;
  mainAccountId: string | null;
  mainAccount: { code: string | null } | null;
};

async function loadPartyMasters(
  party: PartySide,
  where: {
    companyId: string;
    id?: string | { in: string[] };
    customerCategoryId?: string;
    supplierCategoryId?: string;
  }
): Promise<PartyMaster[]> {
  if (party === 'customer') {
    return prisma.customer.findMany({
      where: {
        companyId: where.companyId,
        ...(where.id ? { id: where.id } : {}),
        ...(where.customerCategoryId ? { customerCategoryId: where.customerCategoryId } : {}),
      },
      select: PARTY_SELECT,
    });
  }
  return prisma.supplier.findMany({
    where: {
      companyId: where.companyId,
      ...(where.id ? { id: where.id } : {}),
      ...(where.supplierCategoryId ? { supplierCategoryId: where.supplierCategoryId } : {}),
    },
    select: PARTY_SELECT,
  });
}

async function collectPartyJournals(
  drafts: PartyItemDraft[],
  filters: PartyFilters,
  party: PartySide,
  posted: { isPosted?: boolean },
  date: { gte?: Date; lte?: Date; lt?: Date } | undefined,
  partyId: string | undefined,
  categoryId: string | undefined
) {
  const companyId = filters.companyId;
  const partyType = party === 'customer' ? 'CUSTOMER' : 'SUPPLIER';
  const bounded = Boolean(partyId || categoryId);
  const masterWhere = {
    companyId,
    ...(partyId ? { id: partyId } : {}),
    ...(categoryId && party === 'customer' ? { customerCategoryId: categoryId } : {}),
    ...(categoryId && party === 'supplier' ? { supplierCategoryId: categoryId } : {}),
  };
  const parties = bounded ? await loadPartyMasters(party, masterWhere) : [];
  if (bounded && parties.length === 0) return;

  const accountToParty = uniquePartyAccounts(parties);
  const partyFilter = bounded
    ? {
        OR: [
          { partnerType: partyType, partnerId: { in: parties.map((row) => row.id) } },
          ...(accountToParty.size
            ? [{ accountId: { in: [...accountToParty.keys()] }, partnerId: null }]
            : []),
        ],
      }
    : { partnerType: partyType };

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      ...partyFilter,
      journalEntry: {
        companyId,
        isCancelled: false,
        deletedAt: null,
        ...posted,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(date ? { date } : {}),
        ...(filters.userId ? { createdBy: filters.userId } : {}),
      },
    },
    take: 5000,
    select: {
      debitBase: true,
      creditBase: true,
      partnerId: true,
      accountId: true,
      description: true,
      journalEntry: {
        select: {
          id: true,
          date: true,
          voucherNumber: true,
          legacyGlNum: true,
          sourceNumber: true,
          sourceType: true,
          sourceKind: true,
          description: true,
          descriptionAr: true,
        },
      },
    },
  });

  const known = new Map(parties.map((row) => [row.id, row]));
  const missingIds = [
    ...new Set(
      lines
        .map((line) => line.partnerId || accountToParty.get(line.accountId) || '')
        .filter((id) => id && !known.has(id))
    ),
  ];
  if (missingIds.length) {
    const extra = await loadPartyMasters(party, { companyId, id: { in: missingIds } });
    for (const row of extra) known.set(row.id, row);
  }

  for (const line of lines) {
    const kind = resolveJournalSourceKind(line.journalEntry.sourceType, line.journalEntry.sourceKind);
    if (DOCUMENT_JOURNAL_KINDS.has(kind)) continue;
    const id = line.partnerId || accountToParty.get(line.accountId);
    if (!id) continue;
    const owner = known.get(id);
    if (!owner) continue;
    const debit = round2(money(line.debitBase));
    const credit = round2(money(line.creditBase));
    if (debit === 0 && credit === 0) continue;
    const identity = partyIdentity(owner);
    const description = journalMovementLabel(
      line.journalEntry.sourceType,
      line.description || line.journalEntry.descriptionAr || line.journalEntry.description
    );
    drafts.push({
      partyId: id,
      partyCode: identity.code,
      partyName: identity.name,
      date: line.journalEntry.date.toISOString(),
      invoiceNumber:
        line.journalEntry.voucherNumber || line.journalEntry.legacyGlNum || line.journalEntry.sourceNumber || '',
      description,
      itemName: '',
      itemGroupName: '',
      itemCategoryName: '',
      unitName: '',
      quantity: null,
      unitPrice: null,
      debit,
      credit,
      journalEntryId: line.journalEntry.id,
      invoicePreviewPath: `/accounting/operations/journal-entry?id=${encodeURIComponent(line.journalEntry.id)}`,
    });
  }
}
