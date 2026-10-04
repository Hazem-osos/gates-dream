import { roundTo2 } from '../pos/utils/pos-money';
import { mapVatLineTax } from '../electronic-invoices/utils/eta-tax-table';
import {
  resolveItemCodification,
  validateEgsItemCode,
  validateGs1ItemCode,
} from '../electronic-invoices/utils/eta-egypt-validation';
import { ERECEIPT_LIMITS } from './limits';
import { mapReceiptPaymentMethod, type PaymentMapInput } from './payment-map';
import { buildBuyer, type BuyerSource, type EtaBuyer, validateExplicitBuyer } from './buyer';
import { etaDateTime } from './uuid';
import { receiptTypeDefinition } from './receipt-types';
import { taxSubtypeBelongs } from './eta-codes';

export type FiscalLine = {
  description: string;
  internalCode: string;
  itemCode: string | null;
  itemType: 'GS1' | 'EGS' | null;
  unitType: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  discountPercent?: number | null;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
  isGift: boolean;
  valueDifference?: number | null;
  extraTaxes?: Array<{ taxType: string; subType: string; amount: number; rate?: number }>;
  /** May 2023 item fields. Sent only when a second discount source is supplied. */
  additionalCommercialDiscount?: number | null;
  additionalItemDiscount?: number | null;
};

export type FiscalAddress = {
  country: string;
  governate: string;
  regionCity: string;
  street: string;
  buildingNumber: string;
  postalCode?: string | null;
  floor?: string | null;
  room?: string | null;
  landmark?: string | null;
  additionalInformation?: string | null;
};

export type FiscalSnapshot = {
  receiptType: string;
  receiptNumber: string;
  previousUUID: string;
  referenceUUID?: string | null;
  referenceOldUUID?: string | null;
  issuedAt: Date;
  now: Date;
  currencyCode: string;
  exchangeRate?: number | null;
  headerDiscount: number;
  netAmount: number;
  lines: FiscalLine[];
  payments: PaymentMapInput[];
  paymentOverrides?: Record<string, string> | null;
  customer: BuyerSource | null;
  buyerThreshold: number;
  sellerRin: string;
  companyTradeName: string;
  branchCode: string;
  deviceSerialNumber: string;
  activityCode: string;
  syndicateLicenseNumber?: string | null;
  address: FiscalAddress;
  enabledTypes: string[];
  rwrReason?: string | null;
  rwrReasons?: string[] | null;
  salesIssuedDateTime?: string | null;
  originalIssuedAt?: Date | null;
  orderDeliveryMode?: string | null;
  paymentNumber?: string | null;
  salesOrderCode?: string | null;
  grossWeight?: number | null;
  netWeight?: number | null;
  /** When set, buyer type/id/name come from the form instead of CRM customer inference. */
  explicitBuyer?: EtaBuyer | null;
};

export type ValidationIssue = {
  step: string;
  propertyPath: string;
  errorCode: string;
  message: string;
  messageAr: string;
};

const issue = (step: string, propertyPath: string, errorCode: string, message: string, messageAr: string): ValidationIssue => ({
  step,
  propertyPath,
  errorCode,
  message,
  messageAr,
});

function omitEmpty<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item == null || item === '') continue;
    out[key] = item;
  }
  return out as T;
}

export function buildReceiptDocument(input: FiscalSnapshot): { document: Record<string, unknown> | null; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const definition = receiptTypeDefinition(input.receiptType);
  if (!definition) {
    errors.push(issue('schema', 'documentType.receiptType', 'RECEIPT_TYPE', 'Receipt type is not in the v1.2 registry', 'نوع الإيصال غير معروف'));
  } else if (!input.enabledTypes.includes(input.receiptType)) {
    errors.push(issue('schema', 'documentType.receiptType', 'RECEIPT_TYPE_DISABLED', 'This company has not enabled that receipt type', 'نوع الإيصال غير مفعّل للشركة'));
  }
  if (definition?.orderDeliveryMode === 'required' && !String(input.orderDeliveryMode ?? '').trim()) {
    errors.push(issue('schema', 'header.orderdeliveryMode', 'DELIVERY_MODE', 'This receipt type requires an order delivery mode', 'نوع الإيصال يحتاج طريقة تسليم'));
  }
  if (definition?.kind === 'sale' && input.referenceUUID) {
    errors.push(issue('schema', 'header.referenceUUID', 'REFERENCE_ON_SALE', 'A sale receipt cannot carry a return reference', 'إيصال البيع لا يحمل مرجع مرتجع'));
  }
  if (input.lines.length < 1 || input.lines.length > ERECEIPT_LIMITS.maxLinesPerReceipt) {
    errors.push(issue('schema', 'itemData', 'LINE_COUNT', 'Receipt must have 1 to 300 lines', 'عدد البنود يجب أن يكون من 1 إلى 300'));
  }
  if (!input.receiptNumber || input.receiptNumber.length > ERECEIPT_LIMITS.maxReceiptNumberLength) {
    errors.push(issue('schema', 'header.receiptNumber', 'RECEIPT_NUMBER', 'Receipt number is missing or too long', 'رقم الإيصال ناقص أو أطول من المسموح'));
  }
  if (input.previousUUID !== '' && !/^[0-9a-f]{64}$/.test(input.previousUUID)) {
    errors.push(issue('chain', 'header.previousUUID', 'PREVIOUS_UUID', 'previousUUID must be empty or a 64-character hash', 'الإيصال السابق غير صالح'));
  }
  if (input.issuedAt.getTime() > input.now.getTime() + 60_000) {
    errors.push(issue('date', 'header.dateTimeIssued', 'FUTURE_ISSUE', 'Issuance time is in the future', 'وقت الإصدار في المستقبل'));
  }
  if (definition?.kind === 'return') {
    if (!input.referenceUUID || !/^[0-9a-f]{64}$/.test(input.referenceUUID)) {
      errors.push(issue('return', 'header.referenceUUID', 'REFERENCE_UUID', 'Return receipt needs the original sale UUID', 'مرتجع الإيصال يحتاج UUID إيصال البيع'));
    }
    if (input.originalIssuedAt && input.now.getTime() - input.originalIssuedAt.getTime() > ERECEIPT_LIMITS.returnWindowMs) {
      errors.push(issue('return', 'header.referenceUUID', 'RETURN_WINDOW', 'Return is outside the allowed period from the sale receipt', 'المرتجع خارج المدة المسموحة من إيصال البيع'));
    }
  }
  if (definition?.kind === 'return-without-reference') {
    const reason = String(input.rwrReason ?? '').trim();
    const allowed = input.rwrReasons ?? [];
    if (!reason || !allowed.includes(reason)) {
      errors.push(issue('rwr', 'header.documentUseReason', 'RWR_REASON', 'Return without reference needs an enabled official reason code', 'مرتجع بدون مرجع يحتاج سببًا مفعّلًا'));
    }
    if (!input.salesIssuedDateTime) {
      errors.push(issue('rwr', 'header.salesIssuedDateTime', 'RWR_SALE_TIME', 'Return without reference needs the original sale time', 'مرتجع بدون مرجع يحتاج وقت البيع'));
    }
  }
  if (input.referenceOldUUID && !/^[0-9a-f]{64}$/.test(input.referenceOldUUID)) {
    errors.push(issue('correction', 'header.referenceOldUUID', 'OLD_UUID', 'referenceOldUUID must be the invalid receipt hash', 'مرجع الإيصال غير الصالح غير صحيح'));
  }

  const currency = (input.currencyCode || 'EGP').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.push(issue('currency', 'header.currency', 'CURRENCY', 'Currency must be a 3-letter ISO code', 'العملة غير صالحة'));
  }
  if (currency !== 'EGP' && !(Number(input.exchangeRate) > 0)) {
    errors.push(issue('currency', 'header.exchangeRate', 'EXCHANGE_RATE', 'A foreign-currency receipt needs an exchange rate', 'الإيصال بعملة أجنبية يحتاج سعر تحويل'));
  }

  const sellerRin = input.sellerRin.trim();
  if (!/^\d{9}$/.test(sellerRin)) {
    errors.push(issue('seller', 'seller.rin', 'SELLER_RIN', 'Issuer registration must be 9 digits', 'رقم تسجيل البائع يجب أن يكون 9 أرقام'));
  }
  if (!input.companyTradeName.trim()) {
    errors.push(issue('seller', 'seller.companyTradeName', 'SELLER_NAME', 'Seller trade name is required', 'اسم البائع مطلوب'));
  }
  if (!input.branchCode.trim()) {
    errors.push(issue('seller', 'seller.branchCode', 'BRANCH', 'ETA branch code is required', 'كود فرع المصلحة مطلوب'));
  }
  if (!input.deviceSerialNumber.trim() || input.deviceSerialNumber.length > ERECEIPT_LIMITS.maxPosSerialLength) {
    errors.push(issue('seller', 'seller.deviceSerialNumber', 'DEVICE', 'POS serial is required and must be at most 100 characters', 'مسلسل جهاز نقطة البيع مطلوب'));
  }
  if (!input.activityCode.trim()) {
    errors.push(issue('seller', 'seller.activityCode', 'ACTIVITY', 'Activity code is required', 'كود النشاط مطلوب'));
  }
  for (const field of ['country', 'governate', 'regionCity', 'street', 'buildingNumber'] as const) {
    if (!String(input.address[field] ?? '').trim()) {
      errors.push(issue('seller', `seller.branchAddress.${field}`, 'ADDRESS', `Branch address ${field} is required`, `عنوان الفرع ناقص: ${field}`));
    }
  }
  if (input.address.country && input.address.country.toUpperCase() !== 'EG') {
    errors.push(issue('seller', 'seller.branchAddress.country', 'COUNTRY', 'Issuer country must be EG', 'دولة البائع يجب أن تكون EG'));
  }

  const payment = mapReceiptPaymentMethod(input.payments, input.paymentOverrides);
  if (!payment.code) {
    errors.push(issue('payment', 'paymentMethod', payment.error ?? 'PAYMENT', 'Payment method is not mapped to an ETA code', 'طريقة الدفع غير مربوطة بكود المصلحة'));
  }

  const itemData: Record<string, unknown>[] = [];
  let totalSales = 0;
  let totalCommercialDiscount = 0;
  let totalItemsDiscount = 0;
  let netAmount = 0;
  let totalAmount = 0;
  const taxByType = new Map<string, number>();

  input.lines.forEach((line, index) => {
    const path = `itemData[${index}]`;
    const quantity = Math.abs(line.quantity);
    const unitPrice = Math.abs(line.unitPrice);
    if (!(quantity > 0)) {
      errors.push(issue('item', `${path}.quantity`, 'QUANTITY', 'Quantity must be greater than zero', 'الكمية يجب أن تكون أكبر من صفر'));
    }
    const totalSale = roundTo2(quantity * unitPrice);
    const discount = roundTo2(Math.abs(line.discountAmount));
    const giftUntaxed = line.isGift && roundTo2(line.taxAmount) === 0;
    const commercial = giftUntaxed ? 0 : discount;
    const itemDiscount = giftUntaxed ? discount : 0;
    const netSale = roundTo2(totalSale - commercial - itemDiscount);
    const taxAmount = roundTo2(line.taxAmount);
    const extraTaxAmount = roundTo2((line.extraTaxes ?? []).reduce((sum, row) => sum + row.amount, 0));
    const total = roundTo2(netSale + taxAmount + extraTaxAmount);
    if (Math.abs(total - roundTo2(Math.abs(line.lineTotal))) > 0.02) {
      errors.push(issue('totals', `${path}.total`, 'LINE_TOTAL', 'Line total does not match quantity, price, discount and tax', 'إجمالي البند لا يطابق الكمية والسعر والخصم والضريبة'));
    }
    const rawCode = String(line.itemCode ?? '').trim();
    if (!rawCode) {
      errors.push(issue('item', `${path}.itemCode`, 'ITEM_CODE', 'Item has no GS1 or EGS code', 'الصنف بلا كود GS1 أو EGS'));
    }
    const identity = rawCode ? resolveItemCodification(rawCode, sellerRin) : null;
    const itemType = line.itemType ?? identity?.itemType ?? null;
    const itemCode = line.itemType && rawCode ? rawCode : identity?.itemCode ?? rawCode;
    if (itemType === 'GS1' && !validateGs1ItemCode(itemCode)) {
      errors.push(issue('item', `${path}.itemCode`, 'GS1', 'GS1 item code is invalid', 'كود GS1 غير صالح'));
    }
    if (itemType === 'EGS' && !validateEgsItemCode(itemCode, sellerRin)) {
      errors.push(issue('item', `${path}.itemCode`, 'EGS', 'EGS item code is invalid', 'كود EGS غير صالح'));
    }
    if (itemType !== 'GS1' && itemType !== 'EGS') {
      errors.push(issue('item', `${path}.itemType`, 'ITEM_TYPE', 'Item type must be GS1 or EGS', 'نوع تكويد الصنف يجب أن يكون GS1 أو EGS'));
    }
    const unitType = String(line.unitType ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(unitType)) {
      errors.push(issue('item', `${path}.unitType`, 'UNIT', 'Unit is not an ETA unit code', 'وحدة القياس ليست كود مصلحة'));
    }
    const tax = mapVatLineTax(line.taxPercent, taxAmount);
    const taxes = [
      { taxType: tax.taxType, subType: tax.subType, amount: tax.amount, rate: tax.rate },
      ...(line.extraTaxes ?? []),
    ];
    const seen = new Set<string>();
    for (const row of taxes) {
      if (seen.has(row.taxType)) {
        errors.push(issue('tax', `${path}.taxableItems.taxType`, 'TAX_TYPE_DUP', 'Tax type must be unique on the line', 'نوع الضريبة يتكرر في البند'));
      }
      seen.add(row.taxType);
      if (!taxSubtypeBelongs(row.taxType, row.subType)) {
        errors.push(issue('tax', `${path}.taxableItems.subType`, 'TAX_SUBTYPE', `Subtype ${row.subType} does not belong to ${row.taxType}`, `النوع الفرعي ${row.subType} لا يتبع ${row.taxType}`));
      }
      taxByType.set(row.taxType, roundTo2((taxByType.get(row.taxType) ?? 0) + row.amount));
    }

    const row: Record<string, unknown> = {
      internalCode: line.internalCode.slice(0, 50),
      description: line.description.slice(0, 500),
      itemType,
      itemCode,
      unitType,
      quantity,
      unitPrice,
      netSale,
      totalSale,
      total,
    };
    if (commercial > 0) {
      const discount: Record<string, unknown> = { amount: commercial, description: 'commercial' };
      if (line.discountPercent && line.discountPercent > 0) discount.rate = line.discountPercent;
      row.commercialDiscountData = [discount];
    }
    if (itemDiscount > 0) {
      row.itemDiscountData = [{ amount: itemDiscount, description: 'item' }];
    }
    if (line.valueDifference != null && line.valueDifference !== 0) {
      row.valueDifference = line.valueDifference;
    }
    if (line.additionalCommercialDiscount && line.additionalCommercialDiscount > 0) {
      row.additionalCommercialDiscount = { amount: roundTo2(line.additionalCommercialDiscount), description: 'additional commercial' };
    }
    if (line.additionalItemDiscount && line.additionalItemDiscount > 0) {
      row.additionalItemDiscount = { amount: roundTo2(line.additionalItemDiscount), description: 'additional item' };
    }
    if (taxes.some((rowTax) => rowTax.amount > 0 || (rowTax.rate ?? 0) > 0)) {
      row.taxableItems = taxes.map((rowTax) => ({
        taxType: rowTax.taxType,
        amount: rowTax.amount,
        subType: rowTax.subType,
        ...(rowTax.rate != null ? { rate: rowTax.rate } : {}),
      }));
    }
    itemData.push(row);
    totalSales = roundTo2(totalSales + totalSale);
    totalCommercialDiscount = roundTo2(totalCommercialDiscount + commercial);
    totalItemsDiscount = roundTo2(totalItemsDiscount + itemDiscount);
    netAmount = roundTo2(netAmount + netSale);
    totalAmount = roundTo2(totalAmount + total);
  });

  const extra = roundTo2(input.headerDiscount);
  if (extra > 0) totalAmount = roundTo2(totalAmount - extra);
  if (Math.abs(totalAmount - roundTo2(Math.abs(input.netAmount))) > 0.05) {
    errors.push(issue('totals', 'totalAmount', 'RECEIPT_TOTAL', 'Receipt total does not match the posted POS net', 'إجمالي الإيصال لا يطابق صافي أمر البيع'));
  }

  const builtBuyer = input.explicitBuyer
    ? validateExplicitBuyer({
        buyer: input.explicitBuyer,
        totalAmount,
        threshold: input.buyerThreshold,
        sellerRin,
        paymentNumber: input.paymentNumber,
      })
    : buildBuyer({
        customer: input.customer,
        totalAmount,
        threshold: input.buyerThreshold,
        sellerRin,
      });
  for (const row of builtBuyer.errors) {
    errors.push(issue('buyer', 'buyer', row.code, row.message, row.messageAr));
  }

  if (errors.length > 0) return { document: null, errors };

  const header: Record<string, unknown> = {
    dateTimeIssued: etaDateTime(input.issuedAt),
    receiptNumber: input.receiptNumber,
    uuid: '',
    previousUUID: input.previousUUID,
    currency,
  };
  if (currency !== 'EGP') header.exchangeRate = input.exchangeRate;
  if (input.referenceOldUUID) header.referenceOldUUID = input.referenceOldUUID;
  if (definition?.kind === 'return' && input.referenceUUID) header.referenceUUID = input.referenceUUID;
  if (String(input.orderDeliveryMode ?? '').trim()) header.orderdeliveryMode = String(input.orderDeliveryMode).trim();
  if (String(input.salesOrderCode ?? '').trim()) header.sOrderNameCode = String(input.salesOrderCode).trim().slice(0, 200);
  if (input.grossWeight != null && input.grossWeight > 0) header.grossWeight = input.grossWeight;
  if (input.netWeight != null && input.netWeight > 0) header.netWeight = input.netWeight;
  if (definition?.kind === 'return-without-reference') {
    header.documentUseReason = input.rwrReason;
    header.salesIssuedDateTime = input.salesIssuedDateTime;
  }

  const address = omitEmpty({
    country: input.address.country.toUpperCase(),
    governate: input.address.governate,
    regionCity: input.address.regionCity,
    street: input.address.street,
    buildingNumber: input.address.buildingNumber,
    postalCode: input.address.postalCode,
    floor: input.address.floor,
    room: input.address.room,
    landmark: input.address.landmark,
    additionalInformation: input.address.additionalInformation,
  });

  const seller = omitEmpty({
    rin: sellerRin,
    companyTradeName: input.companyTradeName.slice(0, 200),
    branchCode: input.branchCode,
    branchAddress: address,
    deviceSerialNumber: input.deviceSerialNumber,
    syndicateLicenseNumber: input.syndicateLicenseNumber,
    activityCode: input.activityCode,
  });

  const buyerExtra = builtBuyer.buyer as EtaBuyer & { paymentNumber?: string };
  const buyer = omitEmpty({
    ...buyerExtra,
    ...(input.explicitBuyer ? {} : { paymentNumber: input.paymentNumber?.trim() || undefined }),
    ...(buyerExtra.paymentNumber ? { paymentNumber: buyerExtra.paymentNumber } : {}),
  });
  const document: Record<string, unknown> = {
    header,
    documentType: { receiptType: input.receiptType, typeVersion: '1.2' },
    seller,
    buyer,
    itemData,
    totalSales,
    netAmount,
    totalAmount,
    paymentMethod: payment.code,
  };
  if (totalCommercialDiscount > 0) document.totalCommercialDiscount = totalCommercialDiscount;
  if (totalItemsDiscount > 0) document.totalItemsDiscount = totalItemsDiscount;
  if (extra > 0) document.extraReceiptDiscountData = [{ amount: extra, description: 'receipt' }];
  if (taxByType.size > 0) {
    document.taxTotals = [...taxByType.entries()].map(([taxType, amount]) => ({ taxType, amount }));
  }
  return { document, errors: [] };
}

/** Correction may change identity fields. Money stays on the frozen receipt. */
export function applyReceiptCorrection(
  frozen: Record<string, unknown>,
  patch: {
    buyer?: { type?: 'B' | 'P' | 'F'; id?: string; name?: string };
    lines?: Array<{ index: number; itemCode?: string; itemType?: 'GS1' | 'EGS'; unitType?: string; subType?: string }>;
  }
): { document: Record<string, unknown>; rejected: string | null } {
  const next = structuredClone(frozen);
  if (patch.buyer && next.buyer && typeof next.buyer === 'object') {
    const buyer = next.buyer as Record<string, unknown>;
    if (patch.buyer.type) buyer.type = patch.buyer.type;
    if (patch.buyer.id) buyer.id = patch.buyer.id;
    if (patch.buyer.name) buyer.name = patch.buyer.name;
  }
  const items = Array.isArray(next.itemData) ? next.itemData : [];
  for (const line of patch.lines ?? []) {
    const row = items[line.index];
    if (!row || typeof row !== 'object') return { document: next, rejected: 'LINE' };
    const item = row as Record<string, unknown>;
    if (line.itemCode) item.itemCode = line.itemCode;
    if (line.itemType) item.itemType = line.itemType;
    if (line.unitType) item.unitType = line.unitType;
    if (line.subType && Array.isArray(item.taxableItems) && item.taxableItems[0] && typeof item.taxableItems[0] === 'object') {
      (item.taxableItems[0] as Record<string, unknown>).subType = line.subType;
    }
  }
  if (moneySignature(frozen) !== moneySignature(next)) return { document: frozen, rejected: 'MONEY' };
  return { document: next, rejected: null };
}

function moneySignature(document: Record<string, unknown>): string {
  const items = Array.isArray(document.itemData) ? document.itemData : [];
  return JSON.stringify({
    totalSales: document.totalSales,
    totalCommercialDiscount: document.totalCommercialDiscount ?? null,
    totalItemsDiscount: document.totalItemsDiscount ?? null,
    netAmount: document.netAmount,
    totalAmount: document.totalAmount,
    lines: items.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalSale: item.totalSale,
        netSale: item.netSale,
        total: item.total,
      };
    }),
  });
}
