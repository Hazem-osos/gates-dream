import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo2 } from '../utils/pos-money';
import { priceFromListRow, tierPrice } from './pos-pricing.service';

export type PosSettlementType = 'CASH' | 'BANK' | 'CREDIT' | 'GIFT_CARD' | 'STORE_CREDIT' | 'POINTS' | 'EXCHANGE' | 'DEPOSIT';

const LIABILITY_METHODS = new Set<PosSettlementType>(['GIFT_CARD', 'STORE_CREDIT', 'POINTS', 'EXCHANGE', 'DEPOSIT']);

export type PosPaymentDraft = {
  method: string;
  amount: number;
  tenderedAmount?: number;
  safeId?: string;
  bankAccountId?: string;
  referenceNumber?: string;
  currencyCode?: string;
  exchangeRate?: number;
  captureStatus?: string;
  provider?: string;
  providerRef?: string;
};

export type PreparedPosPayment = {
  method: string;
  settlementType: PosSettlementType;
  methodLabel: string | null;
  paymentMethodId: string | null;
  amount: number;
  tenderedAmount: number | null;
  changeAmount: number | null;
  safeId: string | null;
  bankAccountId: string | null;
  glAccountId: string;
  currencyCode: string;
  exchangeRate: number;
  foreignAmount: number | null;
  referenceNumber: string | null;
  captureStatus: string;
  provider: string | null;
  providerRef: string | null;
};

const BANK_METHODS = new Set(['CARD', 'BANK', 'WALLET']);

export function builtinSettlement(method: string): PosSettlementType | null {
  if (method === 'CASH') return 'CASH';
  if (method === 'CREDIT') return 'CREDIT';
  if (BANK_METHODS.has(method)) return 'BANK';
  return null;
}

function settlementOf(row: PreparedPosPayment): PosSettlementType {
  return row.settlementType;
}

export async function preparePosPayments(params: {
  companyId: string;
  netAmount: number;
  customerId?: string | null;
  terminalSafeId: string;
  terminalBankAccountId?: string | null;
  terminalId?: string | null;
  branchId?: string | null;
  payments: PosPaymentDraft[];
  cashGlForSafe: (safeId: string) => Promise<string>;
  bankGlForAccount: (bankAccountId: string) => Promise<string>;
  arAccountId: string;
  liabilityAccounts?: Partial<Record<'GIFT_CARD' | 'STORE_CREDIT' | 'POINTS' | 'EXCHANGE' | 'DEPOSIT', string | null>>;
}): Promise<PreparedPosPayment[]> {
  if (!params.payments.length) {
    throw new AppError(422, 'POS payment lines are required');
  }

  const configured = await prisma.posPaymentMethod.findMany({
    where: { companyId: params.companyId },
  });
  const prepared: PreparedPosPayment[] = [];
  for (const raw of params.payments) {
    const amount = roundTo2(raw.amount);
    if (amount <= 0) throw new AppError(422, 'Each POS payment amount must be greater than zero');
    const method = raw.method.trim().toUpperCase();
    const liability = LIABILITY_METHODS.has(method as PosSettlementType);
    const configuredRow = liability ? undefined : configured.find((row) => row.code === method);
    const inScope =
      !configuredRow ||
      ((!configuredRow.terminalId || configuredRow.terminalId === params.terminalId) &&
        (!configuredRow.branchId || configuredRow.branchId === params.branchId));
    if (!liability && configured.length > 0) {
      if (!configuredRow || !configuredRow.isActive || !inScope) {
        throw new AppError(422, 'POS payment method is not active');
      }
    } else if (!liability && configured.length === 0 && !builtinSettlement(method)) {
      throw new AppError(422, 'Unknown POS payment method');
    }
    const settlementType: PosSettlementType = liability
      ? (method as PosSettlementType)
      : ((configuredRow?.settlementType as PosSettlementType | undefined) ??
        builtinSettlement(method) ??
        'BANK');
    if (!liability && settlementType !== 'CASH' && settlementType !== 'BANK' && settlementType !== 'CREDIT') {
      throw new AppError(422, 'Unknown POS payment method');
    }
    let tenderedAmount: number | null = null;
    let changeAmount: number | null = null;
    let safeId: string | null = null;
    let bankAccountId: string | null = null;
    let glAccountId: string;

    if (settlementType === 'CASH') {
      safeId = configuredRow?.safeId || raw.safeId || params.terminalSafeId;
      const tendered = roundTo2(raw.tenderedAmount ?? amount);
      if (tendered + 0.001 < amount) {
        throw new AppError(422, 'Cash tendered is less than the cash amount kept in the drawer');
      }
      tenderedAmount = tendered;
      changeAmount = roundTo2(tendered - amount);
      glAccountId = await params.cashGlForSafe(safeId);
    } else if (settlementType === 'BANK') {
      bankAccountId =
        configuredRow?.bankAccountId ||
        raw.bankAccountId ||
        params.terminalBankAccountId ||
        null;
      if (!bankAccountId) throw new AppError(422, 'This payment method needs a bank account');
      glAccountId = await params.bankGlForAccount(bankAccountId);
      if ((configuredRow?.captureMode ?? 'MANUAL') === 'TERMINAL') {
        if (raw.captureStatus !== 'APPROVED' || !raw.providerRef?.trim()) {
          throw new AppError(422, 'Electronic payment is not approved by a provider');
        }
      }
    } else if (settlementType === 'CREDIT') {
      if (!params.customerId) throw new AppError(422, 'Credit payment needs a customer');
      glAccountId = params.arAccountId;
    } else {
      const liabilityGl = params.liabilityAccounts?.[settlementType as 'GIFT_CARD'];
      if (!liabilityGl) throw new AppError(422, 'This tender needs a liability account in POS settings');
      if ((settlementType === 'STORE_CREDIT' || settlementType === 'POINTS') && !params.customerId) {
        throw new AppError(422, 'This tender needs a customer');
      }
      if ((settlementType === 'GIFT_CARD' || settlementType === 'DEPOSIT') && !raw.referenceNumber?.trim()) {
        throw new AppError(422, 'This tender needs a reference');
      }
      glAccountId = liabilityGl;
    }

    const currencyCode = (raw.currencyCode || 'EGP').trim().toUpperCase();
    let exchangeRate = 1;
    let foreignAmount: number | null = null;
    let functionalAmount = amount;
    if (currencyCode !== 'EGP') {
      if (settlementType !== 'CASH' && settlementType !== 'BANK') {
        throw new AppError(422, 'Foreign currency is only accepted on cash or bank tenders');
      }
      const currency = await prisma.currency.findFirst({
        where: { companyId: params.companyId, code: currencyCode, isActive: true },
        select: { exchangeRate: true },
      });
      const tableRate = Number(currency?.exchangeRate ?? 0);
      if (!(tableRate > 0)) throw new AppError(422, 'Currency rate is not configured');
      if (raw.exchangeRate != null && Math.abs(raw.exchangeRate - tableRate) > 0.0001) {
        throw new AppError(422, 'Exchange rate does not match the company rate');
      }
      if (raw.tenderedAmount != null && Math.abs(raw.tenderedAmount - amount) > 0.001) {
        throw new AppError(422, 'Foreign cash does not give change in this register');
      }
      exchangeRate = tableRate;
      foreignAmount = amount;
      functionalAmount = roundTo2(amount * tableRate);
      tenderedAmount = functionalAmount;
      changeAmount = 0;
    }

    prepared.push({
      method,
      settlementType,
      methodLabel: configuredRow?.displayName ?? null,
      paymentMethodId: configuredRow?.id ?? null,
      amount: functionalAmount,
      tenderedAmount,
      changeAmount,
      safeId,
      bankAccountId,
      glAccountId,
      currencyCode,
      exchangeRate,
      foreignAmount,
      referenceNumber: raw.referenceNumber?.trim() || null,
      captureStatus: raw.captureStatus || 'MANUAL',
      provider: raw.provider?.trim() || null,
      providerRef: raw.providerRef?.trim() || null,
    });
  }

  const paid = roundTo2(prepared.reduce((sum, row) => sum + row.amount, 0));
  if (Math.abs(paid - roundTo2(params.netAmount)) > 0.001) {
    throw new AppError(422, 'Payment lines must equal the amount due');
  }

  const credit = roundTo2(
    prepared.filter((row) => settlementOf(row) === 'CREDIT').reduce((sum, row) => sum + row.amount, 0)
  );
  if (credit > 0 && params.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, companyId: params.companyId },
      select: { creditLimit: true },
    });
    if (customer?.creditLimit != null && credit > Number(customer.creditLimit) + 0.001) {
      throw new AppError(422, 'Credit payment exceeds the customer credit limit');
    }
  }

  return prepared;
}

export function paymentColumnTotals(payments: PreparedPosPayment[]) {
  const cash = roundTo2(
    payments.filter((row) => row.settlementType === 'CASH').reduce((sum, row) => sum + row.amount, 0)
  );
  const card = roundTo2(
    payments.filter((row) => row.settlementType === 'BANK').reduce((sum, row) => sum + row.amount, 0)
  );
  const credit = roundTo2(
    payments.filter((row) => row.settlementType === 'CREDIT').reduce((sum, row) => sum + row.amount, 0)
  );
  const methods = new Set(payments.map((row) => row.settlementType));
  const paymentMethod =
    methods.size > 1
      ? 'SPLIT'
      : payments[0]?.settlementType === 'CASH'
        ? 'CASH'
        : payments[0]?.settlementType === 'CREDIT'
          ? 'CREDIT'
          : payments[0]?.settlementType === 'BANK'
            ? 'CARD'
            : payments[0]?.method ?? 'CASH';
  return { cash, card, credit, paymentMethod };
}

export function paymentCreateData(companyId: string, orderId: string, payments: PreparedPosPayment[]) {
  return payments.map((row) => ({
    companyId,
    orderId,
    method: row.method,
    settlementType: row.settlementType,
    methodLabel: row.methodLabel,
    paymentMethodId: row.paymentMethodId,
    amount: new Decimal(row.amount),
    tenderedAmount: row.tenderedAmount == null ? null : new Decimal(row.tenderedAmount),
    changeAmount: row.changeAmount == null ? null : new Decimal(row.changeAmount),
    safeId: row.safeId,
    bankAccountId: row.bankAccountId,
    currencyCode: row.currencyCode,
    exchangeRate: new Decimal(row.exchangeRate),
    foreignAmount: row.foreignAmount == null ? null : new Decimal(row.foreignAmount),
    referenceNumber: row.referenceNumber,
    captureStatus: row.captureStatus,
    provider: row.provider,
    providerRef: row.providerRef,
  }));
}

export async function catalogPriceForItem(params: {
  companyId: string;
  itemId: string;
  unitId: string;
  priceListId?: string | null;
  priceTier?: string | null;
}) {
  const item = await prisma.item.findFirst({
    where: { id: params.itemId, companyId: params.companyId },
    select: {
      averageCost: true,
      lastPurchasePrice: true,
      priceRetail: true,
      priceSemiWholesale: true,
      priceWholesale: true,
      priceProjects: true,
      defaultTaxPercent: true,
      category: { select: { taxRate: true, isTaxExempt: true } },
    },
  });
  if (!item) return null;
  const bases = {
    averageCost: Number(item.averageCost),
    lastPurchasePrice: Number(item.lastPurchasePrice),
  };
  let fromList = 0;
  if (params.priceListId) {
    const row = await prisma.itemPrice.findFirst({
      where: { itemId: params.itemId, unitId: params.unitId, priceListId: params.priceListId },
      include: { priceList: { select: { priceMode: true, isActive: true } } },
    });
    fromList = priceFromListRow(
      row
        ? {
            itemId: params.itemId,
            unitId: params.unitId,
            price: row.price,
            retailPrice: row.retailPrice,
            priceList: row.priceList,
          }
        : undefined,
      bases
    );
  }
  const price = fromList > 0 ? fromList : tierPrice(params.priceTier, item);
  const taxPercent = item.category?.isTaxExempt
    ? 0
    : Number(item.defaultTaxPercent ?? item.category?.taxRate ?? 0);
  return { price, taxPercent };
}

export { tierPrice };
