import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  applyCustomerMasterWhere,
  applySupplierMasterWhere,
} from '../../accounting/services/party-group-filter';
import {
  buildPartyCurrencySheet,
  mergeAppearingCurrencies,
  type PartyCurrencyInfo,
  type PartyCurrencyLine,
  type PartyCurrencyName,
} from './party-currency-statement-sheet';

const PARTY_LINE_SELECT = {
  id: true,
  lineNumber: true,
  accountId: true,
  partnerId: true,
  debit: true,
  credit: true,
  debitBase: true,
  creditBase: true,
  currencyCode: true,
  description: true,
  descriptionAr: true,
  invoiceNumber: true,
  journalEntry: {
    select: {
      date: true,
      voucherNumber: true,
      legacyGlNum: true,
      id: true,
      sourceId: true,
      sourceType: true,
      sourceKind: true,
      sourceNumber: true,
      description: true,
      descriptionAr: true,
      currencyCode: true,
    },
  },
} as const;

type StatementFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  customerId?: string;
  supplierId?: string;
  customerCategoryId?: string;
  supplierCategoryId?: string;
  currencyId?: string;
  branchId?: string;
  userId?: string;
  showUnposted?: boolean;
};

type StatementOptions = {
  page?: number;
  limit?: number;
};

function postedUnlessRequested(filters: { showUnposted?: boolean }) {
  return filters.showUnposted ? {} : { isPosted: true };
}

function postedPartyJournalWhere(
  companyId: string,
  filters: StatementFilters,
  date?: { gte?: Date; lte?: Date; lt?: Date }
) {
  return {
    companyId,
    ...postedUnlessRequested(filters),
    isCancelled: false,
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.userId ? { createdBy: String(filters.userId) } : {}),
    ...(date ? { date } : {}),
  };
}

function uniquePersonalAccounts(parties: Array<{ id: string; accountId: string | null }>) {
  const counts = new Map<string, number>();
  for (const party of parties) {
    if (!party.accountId) continue;
    counts.set(party.accountId, (counts.get(party.accountId) || 0) + 1);
  }
  const map = new Map<string, string>();
  for (const party of parties) {
    if (party.accountId && counts.get(party.accountId) === 1) map.set(party.accountId, party.id);
  }
  return map;
}

function partyCode(row: { code?: string | null; serial?: string | null }) {
  return String(row.code || row.serial || '').trim();
}

async function resolveCompanyCurrencies(companyId: string, currencyId?: string) {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { defaultCurrency: true },
  });
  const baseCode = String(settings?.defaultCurrency || 'EGP').trim().toUpperCase() || 'EGP';
  const rows = await prisma.currency.findMany({
    where: { companyId, isActive: true },
    select: { id: true, code: true, arabicName: true, serial: true },
    orderBy: [{ serial: 'asc' }, { code: 'asc' }],
  });
  const mapped: PartyCurrencyInfo[] = rows.map((row) => ({
    code: String(row.code || '').trim().toUpperCase(),
    name: row.arabicName || String(row.code || '').trim().toUpperCase(),
  })).filter((row) => row.code);
  mapped.sort((a, b) => {
    if (a.code === baseCode && b.code !== baseCode) return -1;
    if (b.code === baseCode && a.code !== baseCode) return 1;
    return 0;
  });

  let locked = false;
  let currencies = mapped;
  if (currencyId) {
    const token = String(currencyId).trim();
    const match = rows.find(
      (row) => row.id === token || String(row.code).toUpperCase() === token.toUpperCase()
    );
    if (match) {
      locked = true;
      currencies = [
        {
          code: String(match.code).trim().toUpperCase(),
          name: match.arabicName || String(match.code).trim().toUpperCase(),
        },
      ];
    }
  }
  if (!currencies.length) {
    currencies = [{ code: baseCode, name: baseCode === 'EGP' ? 'جنيه مصري' : baseCode }];
  }
  return { baseCode, currencies, locked };
}

function emptySummary(currencies: PartyCurrencyInfo[]) {
  return {
    currencies: currencies.map((currency) => ({
      code: currency.code,
      name: currency.name,
      debit: 0,
      credit: 0,
      balance: 0,
    })),
  };
}

export async function loadPartyCurrencyStatement(
  filters: StatementFilters,
  options: StatementOptions,
  party: 'customer' | 'supplier'
) {
  const { companyId, fromDate, toDate } = filters;
  const page = options.page ?? 1;
  const limit = options.limit ?? 5000;
  const partyType = party === 'customer' ? 'CUSTOMER' : 'SUPPLIER';
  const bounded = Boolean(
    party === 'customer'
      ? filters.customerId || filters.customerCategoryId
      : filters.supplierId || filters.supplierCategoryId
  );
  const resolved = await resolveCompanyCurrencies(companyId, filters.currencyId);

  const masterWhere: Record<string, unknown> = { companyId };
  if (party === 'customer') applyCustomerMasterWhere(masterWhere, filters);
  else applySupplierMasterWhere(masterWhere, filters);

  const partySelect = { id: true, arabicName: true, accountId: true, code: true, serial: true } as const;
  const parties = bounded
    ? party === 'customer'
      ? await prisma.customer.findMany({
          where: masterWhere as Prisma.CustomerWhereInput,
          select: partySelect,
        })
      : await prisma.supplier.findMany({
          where: masterWhere as Prisma.SupplierWhereInput,
          select: partySelect,
        })
    : [];
  if (bounded && parties.length === 0) {
    return {
      data: [],
      summary: emptySummary(resolved.currencies),
      pagination: { page, limit, total: 0, totalPages: 1 },
    };
  }

  const accountToParty = uniquePersonalAccounts(parties);
  const partyFilter = bounded
    ? {
        OR: [
          { partnerType: partyType, partnerId: { in: parties.map((row) => row.id) } },
          ...(accountToParty.size
            ? [{ accountId: { in: Array.from(accountToParty.keys()) }, partnerId: null }]
            : []),
        ],
      }
    : { partnerType: partyType };

  const loadLines = (date?: { gte?: Date; lte?: Date; lt?: Date }) =>
    prisma.journalEntryLine.findMany({
      where: {
        ...partyFilter,
        journalEntry: postedPartyJournalWhere(companyId, filters, date),
      },
      select: PARTY_LINE_SELECT,
    });

  const periodDate =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;
  const [periodLines, priorLines] = await Promise.all([
    loadLines(periodDate),
    fromDate ? loadLines({ lt: fromDate }) : Promise.resolve([]),
  ]);

  const currencies = mergeAppearingCurrencies(
    resolved.currencies,
    [...periodLines, ...priorLines] as PartyCurrencyLine[],
    resolved.baseCode,
    resolved.locked
  );

  const names = new Map<string, PartyCurrencyName>(
    parties.map((row) => [row.id, { name: row.arabicName || '', code: partyCode(row) }])
  );
  const missingIds = Array.from(
    new Set(
      [...periodLines, ...priorLines]
        .map((line) => line.partnerId)
        .filter((id): id is string => Boolean(id && !names.has(id)))
    )
  );
  if (missingIds.length) {
    const extraSelect = { id: true, arabicName: true, code: true, serial: true } as const;
    const extra =
      party === 'customer'
        ? await prisma.customer.findMany({
            where: { companyId, id: { in: missingIds } },
            select: extraSelect,
          })
        : await prisma.supplier.findMany({
            where: { companyId, id: { in: missingIds } },
            select: extraSelect,
          });
    for (const row of extra) names.set(row.id, { name: row.arabicName || '', code: partyCode(row) });
  }

  const selectedPartyId = party === 'customer' ? filters.customerId : filters.supplierId;
  const sheet = buildPartyCurrencySheet({
    currencies,
    baseCode: resolved.baseCode,
    names,
    accountToParty,
    periodLines: periodLines as PartyCurrencyLine[],
    priorLines: priorLines as PartyCurrencyLine[],
    fromDate,
    selectedPartyId,
    lockCurrency: resolved.locked,
  });

  const skip = (page - 1) * limit;
  return {
    data: sheet.rows.slice(skip, skip + limit),
    summary: sheet.summary,
    pagination: {
      page,
      limit,
      total: sheet.rows.length,
      totalPages: Math.ceil(sheet.rows.length / limit) || 1,
    },
  };
}
