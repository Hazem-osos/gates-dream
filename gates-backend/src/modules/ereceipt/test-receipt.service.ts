import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { roundTo2 } from '../pos/utils/pos-money';
import { taxSubtypeBelongs } from './eta-codes';
import { type FiscalLine, type FiscalSnapshot } from './document';
import { defaultEnabledReceiptTypes } from './receipt-types';
import { ERECEIPT_LIMITS } from './limits';
import { addressFrom, asProfile } from './issue.service';
import { commitFiscalReceipt, persistValidationFailedReceipt, previewFromSnapshot, type IssueSource } from './issue-commit.service';
import { toFiscalPublic, type FiscalPublic } from './issue.service';
import { drainEreceiptOutbox } from './submit.service';
import type { EtaBuyer } from './buyer';

export const PREPRODUCTION_ENV = 'PREPRODUCTION';

export type TestReceiptLineInput = {
  description: string;
  itemType: 'GS1' | 'EGS';
  itemCode: string;
  internalCode: string;
  unitType: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxType: string;
  taxSubType: string;
  taxRate: number;
};

export type TestReceiptPaymentChoice =
  | 'CASH'
  | 'CARD'
  | 'CREDIT_CARD'
  | 'VOUCHER'
  | 'GIFT_CARD'
  | 'POINTS'
  | 'OTHER';

export type TestReceiptInput = {
  buyerType: 'B' | 'P' | 'F';
  buyerId?: string;
  buyerName?: string;
  buyerMobile?: string;
  paymentNumber?: string;
  lines: TestReceiptLineInput[];
  payment: TestReceiptPaymentChoice;
  headerDiscount?: number;
  clientKey?: string;
};

const PAYMENT_MAP: Record<TestReceiptPaymentChoice, { method: string; override?: string }> = {
  CASH: { method: 'CASH' },
  CARD: { method: 'CARD' },
  CREDIT_CARD: { method: 'CARD', override: 'CC' },
  VOUCHER: { method: 'VOUCHER' },
  GIFT_CARD: { method: 'GIFT_CARD' },
  POINTS: { method: 'POINTS' },
  OTHER: { method: 'BANK' },
};

export function assertPreproductionTestAllowed(requestedEnvironment?: string): void {
  if (requestedEnvironment && requestedEnvironment !== PREPRODUCTION_ENV) {
    throw Object.assign(new Error('Manual test receipts are only allowed in PREPRODUCTION'), { statusCode: 403, code: 'PRODUCTION_FORBIDDEN' });
  }
}

export async function resolvePreproductionTestDevice(companyId: string) {
  const devices = await prisma.etaReceiptDevice.findMany({
    where: { companyId, environment: PREPRODUCTION_ENV, active: true },
    include: { terminal: { include: { branch: true } } },
  });
  if (devices.length !== 1) {
    return {
      ok: false as const,
      messageAr: devices.length === 0
        ? 'لا يوجد جهاز PREPRODUCTION واحد مفعّل. اضبط جهاز الاختبار من إعدادات الإيصال.'
        : 'يجب تفعيل جهاز PREPRODUCTION واحد فقط للاختبار اليدوي.',
    };
  }
  const device = devices[0];
  const [company, invoiceSetting, setting] = await Promise.all([
    prisma.company.findFirst({ where: { id: companyId }, select: { arabicName: true, taxNumber1: true } }),
    prisma.eInvoiceSetting.findUnique({ where: { companyId }, select: { issuerTaxId: true, issuerName: true, issuerAddress: true, activityCode: true } }),
    prisma.etaReceiptSetting.findFirst({ where: { companyId, environment: PREPRODUCTION_ENV } }),
  ]);
  const sellerRin = (invoiceSetting?.issuerTaxId || company?.taxNumber1 || '').replace(/\D/g, '').slice(0, 9);
  const branch = device.terminal.branch;
  return {
    ok: true as const,
    device,
    sellerRin,
    companyName: invoiceSetting?.issuerName || company?.arabicName || '',
    branchCode: device.branchCode,
    activityCode: device.activityCode || branch.activityCode || invoiceSetting?.activityCode || '',
    posSerial: device.deviceSerialNumber,
    terminalName: device.terminal.name,
    clientId: device.clientId,
    secretsConfigured: Boolean(device.presharedKeyEnc && device.clientSecretEnc),
    setting,
    address: addressFrom(branch, invoiceSetting?.issuerAddress),
  };
}

function buildTestLine(line: TestReceiptLineInput): FiscalLine {
  const quantity = Math.abs(line.quantity);
  const unitPrice = Math.abs(line.unitPrice);
  const discountAmount = roundTo2(Math.abs(line.discountAmount ?? 0));
  const totalSale = roundTo2(quantity * unitPrice);
  const netSale = roundTo2(totalSale - discountAmount);
  const taxType = line.taxType.trim().toUpperCase();
  const subType = line.taxSubType.trim();
  if (!taxSubtypeBelongs(taxType, subType)) {
    throw Object.assign(new Error(`Subtype ${subType} does not belong to ${taxType}`), { code: 'TAX_SUBTYPE' });
  }
  let taxPercent = 0;
  let taxAmount = 0;
  let extraTaxes: FiscalLine['extraTaxes'];
  if (taxType === 'T1') {
    taxPercent = line.taxRate;
    taxAmount = roundTo2(netSale * line.taxRate / 100);
  } else {
    taxAmount = 0;
    extraTaxes = [{ taxType, subType, amount: roundTo2(netSale * line.taxRate / 100), rate: line.taxRate }];
  }
  const extraTaxAmount = roundTo2((extraTaxes ?? []).reduce((sum, row) => sum + row.amount, 0));
  const lineTotal = roundTo2(netSale + taxAmount + extraTaxAmount);
  return {
    description: line.description,
    internalCode: line.internalCode,
    itemCode: line.itemCode,
    itemType: line.itemType,
    unitType: line.unitType.toUpperCase(),
    quantity,
    unitPrice,
    discountAmount,
    taxPercent,
    taxAmount,
    lineTotal,
    isGift: false,
    extraTaxes,
  };
}

export type TestReceiptBuildContext = {
  sellerRin: string;
  companyName: string;
  branchCode: string;
  activityCode: string;
  address: FiscalSnapshot['address'];
  setting: {
    buyerIdentityThreshold?: unknown;
    enabledReceiptTypes?: unknown;
    paymentMap?: unknown;
    orderDeliveryMode?: string | null;
  } | null;
  device: {
    deviceSerialNumber: string;
    syndicateLicenseNumber: string | null;
  };
};

export function buildTestSnapshot(
  ctx: TestReceiptBuildContext,
  input: TestReceiptInput
): { snapshot: Omit<FiscalSnapshot, 'receiptNumber' | 'previousUUID'>; netAmount: number } {
  const lines = input.lines.map(buildTestLine);
  const netAmount = roundTo2(lines.reduce((sum, row) => sum + row.lineTotal, 0) - Math.abs(input.headerDiscount ?? 0));
  const pay = PAYMENT_MAP[input.payment];
  const overrides = { ...(ctx.setting?.paymentMap && typeof ctx.setting.paymentMap === 'object' ? (ctx.setting.paymentMap as Record<string, string>) : {}) };
  if (pay.override) overrides[pay.method] = pay.override;
  const explicitBuyer: EtaBuyer = {
    type: input.buyerType,
    id: input.buyerId?.trim() || undefined,
    name: input.buyerName?.trim() || undefined,
    mobileNumber: input.buyerMobile?.trim() || undefined,
  };
  const enabled = Array.isArray(ctx.setting?.enabledReceiptTypes)
    ? (ctx.setting.enabledReceiptTypes as string[])
    : defaultEnabledReceiptTypes();
  const snapshot: Omit<FiscalSnapshot, 'receiptNumber' | 'previousUUID'> = {
    receiptType: 's',
    issuedAt: new Date(),
    now: new Date(),
    currencyCode: 'EGP',
    headerDiscount: roundTo2(Math.abs(input.headerDiscount ?? 0)),
    netAmount,
    lines,
    payments: [{ method: pay.method, amount: Math.max(netAmount, 0.01) }],
    paymentOverrides: overrides,
    customer: null,
    explicitBuyer,
    buyerThreshold: ctx.setting ? Number(ctx.setting.buyerIdentityThreshold) : ERECEIPT_LIMITS.defaultBuyerIdentityThresholdEgp,
    sellerRin: ctx.sellerRin,
    companyTradeName: ctx.companyName,
    branchCode: ctx.branchCode,
    deviceSerialNumber: ctx.device.deviceSerialNumber,
    activityCode: ctx.activityCode,
    syndicateLicenseNumber: ctx.device.syndicateLicenseNumber,
    address: ctx.address,
    enabledTypes: enabled.includes('s') ? enabled : [...enabled, 's'],
    paymentNumber: input.paymentNumber?.trim() || null,
    salesOrderCode: 'TEST',
    orderDeliveryMode: ctx.setting?.orderDeliveryMode ?? null,
  };
  return { snapshot, netAmount };
}

export async function previewPreproductionTestReceipt(companyId: string, input: TestReceiptInput) {
  assertPreproductionTestAllowed(PREPRODUCTION_ENV);
  const ctx = await resolvePreproductionTestDevice(companyId);
  if (!ctx.ok) return { ready: false, checks: [{ code: 'DEVICE', ok: false, message: ctx.messageAr, messageAr: ctx.messageAr }], context: null, preview: null };
  const { snapshot } = buildTestSnapshot(ctx, input);
  const draft: FiscalSnapshot = { ...snapshot, receiptNumber: 'PREVIEW', previousUUID: '' };
  const preview = previewFromSnapshot(draft);
  return {
    ready: preview.errors.length === 0,
    checks: preview.errors.map((row) => ({
      code: row.errorCode,
      ok: false,
      message: row.message,
      messageAr: row.messageAr,
      propertyPath: row.propertyPath,
    })),
    context: {
      environment: PREPRODUCTION_ENV,
      companyName: ctx.companyName,
      sellerRin: ctx.sellerRin,
      branchCode: ctx.branchCode,
      activityCode: ctx.activityCode,
      posSerial: ctx.posSerial,
      terminalName: ctx.terminalName,
      clientId: ctx.clientId,
      secretsConfigured: ctx.secretsConfigured,
    },
    preview: preview.document
      ? {
          totals: preview.totals,
          document: preview.document,
          submitPreview: null,
        }
      : null,
  };
}

export async function issuePreproductionTestReceipt(companyId: string, input: TestReceiptInput): Promise<FiscalPublic> {
  assertPreproductionTestAllowed(PREPRODUCTION_ENV);
  if (input.clientKey && input.clientKey.length > 64) {
    return toFiscalPublic({ status: 'ATTENTION', validationErrors: [{ step: 'test', propertyPath: 'clientKey', errorCode: 'CLIENT_KEY', message: 'Client key too long', messageAr: 'مفتاح الطلب طويل جدًا' }] });
  }
  const clientKey = input.clientKey?.trim() || null;
  const ctx = await resolvePreproductionTestDevice(companyId);
  if (!ctx.ok) {
    return toFiscalPublic({
      status: 'CONFIG_FAILED',
      validationErrors: [{ step: 'device', propertyPath: 'environment', errorCode: 'DEVICE', message: ctx.messageAr, messageAr: ctx.messageAr }],
    });
  }
  const { snapshot } = buildTestSnapshot(ctx, input);
  const preview = previewFromSnapshot({ ...snapshot, receiptNumber: 'PREVIEW', previousUUID: '' });
  if (preview.errors.length || !preview.document) {
    await persistValidationFailedReceipt({
      companyId,
      terminalId: ctx.device.terminalId,
      shiftId: null,
      posOrderId: null,
      issueSource: 'PREPRODUCTION_TEST',
      testClientKey: clientKey,
      receiptType: 's',
      generation: 1,
      device: ctx.device,
      errors: preview.errors,
    }).catch(() => undefined);
    return toFiscalPublic({ status: 'VALIDATION_FAILED', validationErrors: preview.errors });
  }

  if (clientKey) {
    const prior = await prisma.etaReceipt.findFirst({ where: { companyId, testClientKey: clientKey, issueSource: 'PREPRODUCTION_TEST' } });
    if (prior?.uuid) return toFiscalPublic(prior);
  }

  const committed = await commitFiscalReceipt({
    companyId,
    terminalId: ctx.device.terminalId,
    shiftId: null,
    posOrderId: null,
    issueSource: 'PREPRODUCTION_TEST',
    testClientKey: clientKey,
    receiptType: 's',
    generation: 1,
    snapshotBase: snapshot,
    device: ctx.device,
    findExisting: async () => {
      if (!clientKey) return null;
      return prisma.etaReceipt.findFirst({ where: { companyId, testClientKey: clientKey, issueSource: 'PREPRODUCTION_TEST' }, select: { id: true, uuid: true } });
    },
  });

  if (committed.kind === 'invalid') {
    const row = await persistValidationFailedReceipt({
      companyId,
      terminalId: ctx.device.terminalId,
      shiftId: null,
      posOrderId: null,
      issueSource: 'PREPRODUCTION_TEST',
      testClientKey: clientKey,
      receiptType: 's',
      generation: 1,
      device: ctx.device,
      errors: committed.errors,
      existingId: committed.existingId,
    });
    return toFiscalPublic({ ...row, validationErrors: committed.errors as unknown as Prisma.JsonValue });
  }

  const row = committed.row;
  if (!row) return toFiscalPublic({ status: 'ATTENTION' });
  if (committed.kind === 'issued' && row.status === 'QUEUED') {
    void drainEreceiptOutbox().catch(() => undefined);
  }
  return toFiscalPublic(row);
}

export async function loadTestReceiptContext(companyId: string) {
  assertPreproductionTestAllowed(PREPRODUCTION_ENV);
  const ctx = await resolvePreproductionTestDevice(companyId);
  if (!ctx.ok) return { ok: false, messageAr: ctx.messageAr };
  return {
    ok: true,
    environment: PREPRODUCTION_ENV,
    companyName: ctx.companyName,
    sellerRin: ctx.sellerRin,
    branchCode: ctx.branchCode,
    activityCode: ctx.activityCode,
    posSerial: ctx.posSerial,
    terminalId: ctx.device.terminalId,
    terminalName: ctx.terminalName,
    clientId: ctx.clientId,
    secretsConfigured: ctx.secretsConfigured,
    noteAr: 'لا تحتاج إلى جهاز كاشير فعلي للاختبار، لكن يجب إدخال بيانات جهاز POS المسجل لدى ETA حتى تستطيع المنظومة المصادقة والإرسال.',
  };
}
