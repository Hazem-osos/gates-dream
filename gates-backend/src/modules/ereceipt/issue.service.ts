import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { logger } from '../../shared/logger';
import { defaultEnabledReceiptTypes, issuedReceiptType, RECEIPT_TYPE_REGISTRY } from './receipt-types';
import { type FiscalAddress, type FiscalSnapshot, type ValidationIssue } from './document';
import { commitFiscalReceipt, persistValidationFailedReceipt } from './issue-commit.service';
import { ERECEIPT_LIMITS } from './limits';
import { redactEreceiptLog } from './errors';

export type FiscalPublic = {
  status: string;
  cashier: 'NONE' | 'PENDING' | 'SENT' | 'VALID' | 'ATTENTION';
  labelAr: string;
  receiptId?: string;
  receiptNumber?: string | null;
  receiptType?: string | null;
  uuid?: string | null;
  previousUUID?: string | null;
  referenceUUID?: string | null;
  referenceOldUUID?: string | null;
  qrUrl?: string | null;
  environment?: string | null;
  etaLongId?: string | null;
  errors?: ValidationIssue[] | null;
  issueSource?: string | null;
  isTestReceipt?: boolean;
};

const SENT = new Set(['SUBMITTING', 'SUBMITTED']);
const ATTENTION = new Set(['VALIDATION_FAILED', 'INVALID', 'RETRYABLE', 'CONFIG_FAILED', 'LATE_WINDOW']);

export function toFiscalPublic(row: {
  id?: string;
  status: string;
  receiptNumber?: string | null;
  receiptType?: string | null;
  uuid?: string | null;
  previousUUID?: string | null;
  referenceUUID?: string | null;
  referenceOldUUID?: string | null;
  qrUrl?: string | null;
  environment?: string | null;
  etaLongId?: string | null;
  validationErrors?: unknown;
  issueSource?: string | null;
}): FiscalPublic {
  const isTestReceipt = row.issueSource === 'PREPRODUCTION_TEST';
  const cashier = row.status === 'NOT_CONFIGURED' || row.status === 'NOT_APPLICABLE'
    ? 'NONE'
    : row.status === 'VALID'
      ? 'VALID'
      : SENT.has(row.status)
        ? 'SENT'
        : row.status === 'QUEUED'
          ? 'PENDING'
          : ATTENTION.has(row.status)
            ? 'ATTENTION'
            : 'PENDING';
  const labelAr = isTestReceipt
    ? (cashier === 'VALID' ? 'إيصال تجريبي — صالح' : cashier === 'NONE' ? 'إيصال تجريبي' : `إيصال تجريبي — ${{
        NONE: '',
        PENDING: 'قيد الإرسال',
        SENT: 'تم الإرسال',
        VALID: 'صالح',
        ATTENTION: 'يتطلب مراجعة',
      }[cashier]}`)
    : {
        NONE: '',
        PENDING: 'قيد الإرسال',
        SENT: 'تم الإرسال',
        VALID: 'صالح',
        ATTENTION: 'يتطلب مراجعة',
      }[cashier];
  return {
    status: row.status,
    cashier,
    labelAr,
    receiptId: row.id,
    receiptNumber: row.receiptNumber,
    receiptType: row.receiptType,
    uuid: row.uuid,
    previousUUID: row.previousUUID,
    referenceUUID: row.referenceUUID,
    referenceOldUUID: row.referenceOldUUID,
    qrUrl: row.qrUrl,
    environment: row.environment,
    etaLongId: row.etaLongId,
    errors: (row.validationErrors as ValidationIssue[] | null) ?? null,
    issueSource: row.issueSource ?? 'POS',
    isTestReceipt,
  };
}

function reasonCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (typeof row === 'string' ? row : row && typeof row === 'object' && 'code' in row ? String((row as { code: unknown }).code) : ''))
    .filter((code) => code.length > 0);
}

export function asProfile(value: unknown): { itemCode?: string; itemType?: 'GS1' | 'EGS'; unitType?: string } {
  if (!value || typeof value !== 'object') return {};
  const row = value as Record<string, unknown>;
  const itemType = row.itemType === 'GS1' || row.itemType === 'EGS' ? row.itemType : undefined;
  return {
    itemCode: typeof row.itemCode === 'string' ? row.itemCode : undefined,
    itemType,
    unitType: typeof row.unitType === 'string' ? row.unitType : undefined,
  };
}

export function addressFrom(branch: {
  country: string | null;
  governorate: string | null;
  city: string | null;
  district: string | null;
  streetName: string | null;
  buildingNumber: string | null;
  postalCode: string | null;
}, fallback: unknown): FiscalAddress {
  const extra = fallback && typeof fallback === 'object' ? (fallback as Record<string, unknown>) : {};
  const text = (value: unknown, alt?: string | null) => String(value ?? alt ?? '').trim();
  return {
    country: text(extra.country, branch.country) || 'EG',
    governate: text(extra.governate, branch.governorate),
    regionCity: text(extra.regionCity, branch.city || branch.district),
    street: text(extra.street, branch.streetName),
    buildingNumber: text(extra.buildingNumber, branch.buildingNumber),
    postalCode: text(extra.postalCode, branch.postalCode) || null,
    floor: text(extra.floor) || null,
    room: text(extra.room) || null,
    landmark: text(extra.landmark) || null,
    additionalInformation: text(extra.additionalInformation) || null,
  };
}

export async function fiscalSnapshot(companyId: string, posOrderId: string): Promise<FiscalPublic | null> {
  const row = await prisma.etaReceipt.findFirst({
    where: { companyId, posOrderId },
    orderBy: { generation: 'desc' },
  });
  return row ? toFiscalPublic(row) : null;
}

export async function issuePostedPosReceipt(
  companyId: string,
  posOrderId: string,
  options?: { rwr?: { reason: string; salesIssuedDateTime: string } }
): Promise<FiscalPublic> {
  const order = await prisma.posOrder.findFirst({
    where: { id: posOrderId, companyId },
    include: {
      lines: { orderBy: { lineOrder: 'asc' }, include: { item: true, unit: true } },
      payments: true,
      customer: true,
      shift: { include: { terminal: { include: { branch: true } } } },
      company: true,
    },
  });
  if (!order || order.status !== 'POSTED') return toFiscalPublic({ status: 'NOT_APPLICABLE' });
  if (order.orderType !== 'SALE' && order.orderType !== 'RETURN') return toFiscalPublic({ status: 'NOT_APPLICABLE' });
  const terminalId = order.shift.terminalId;
  const devices = await prisma.etaReceiptDevice.findMany({ where: { companyId, terminalId, active: true } });
  if (devices.length === 0) return toFiscalPublic({ status: 'NOT_CONFIGURED' });
  const settings = await prisma.etaReceiptSetting.findMany({ where: { companyId } });
  const device = settings.length
    ? devices.find((row) => settings.some((setting) => setting.environment === row.environment)) ?? null
    : devices.length === 1
      ? devices[0]
      : null;
  if (!device) {
    return toFiscalPublic({
      status: 'CONFIG_FAILED',
      validationErrors: [{ step: 'device', propertyPath: 'environment', errorCode: 'ENVIRONMENT', message: 'More than one ETA environment is active for this terminal', messageAr: 'أكثر من بيئة مصلحة مفعّلة لهذا الجهاز' }],
    });
  }
  const setting = settings.find((row) => row.environment === device.environment) ?? null;
  const invoiceSetting = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
  const branch = order.shift.terminal.branch;
  const sellerRin = (invoiceSetting?.issuerTaxId || order.company.taxNumber1 || '').replace(/\D/g, '').slice(0, 9);
  const enabled = Array.isArray(setting?.enabledReceiptTypes)
    ? (setting?.enabledReceiptTypes as string[])
    : defaultEnabledReceiptTypes();

  let receiptType = issuedReceiptType('sale', enabled);
  let referenceUUID: string | null = null;
  let originalIssuedAt: Date | null = null;
  if (order.orderType === 'RETURN') {
    if (options?.rwr) {
      if (order.originalOrderId) {
        return persistInvalid(companyId, order, device, 'RWR', [{
          step: 'rwr',
          propertyPath: 'header.documentUseReason',
          errorCode: 'RWR_LINKED',
          message: 'A linked return uses the original receipt UUID, not a return without reference',
          messageAr: 'المرتجع المرتبط يستخدم إيصال البيع، وليس مرتجعًا بدون مرجع',
        }]);
      }
      receiptType = 'RWR';
    } else {
      receiptType = issuedReceiptType('return', enabled);
      if (!order.originalOrderId) {
        return persistInvalid(companyId, order, device, receiptType, [{
          step: 'return',
          propertyPath: 'header.referenceUUID',
          errorCode: 'REFERENCE_UUID',
          message: 'A linked return needs the original sale. Return without reference is a separate action.',
          messageAr: 'المرتجع المرتبط يحتاج إيصال البيع. المرتجع بدون مرجع إجراء مستقل.',
        }]);
      }
      const originals = await prisma.etaReceipt.findMany({
        where: {
          companyId,
          posOrderId: order.originalOrderId,
          receiptType: { in: RECEIPT_TYPE_REGISTRY.filter((row) => row.kind === 'sale').map((row) => row.code) },
          environment: device.environment,
          uuid: { not: null },
        },
        orderBy: { generation: 'desc' },
      });
      const original = originals.find((row) => row.status === 'VALID') ?? originals[0];
      if (!original?.uuid || !original.dateTimeIssued) {
        return persistInvalid(companyId, order, device, receiptType, [{
          step: 'return',
          propertyPath: 'header.referenceUUID',
          errorCode: 'REFERENCE_UUID',
          message: 'The original sale has no frozen ETA receipt',
          messageAr: 'إيصال البيع الأصلي غير مُصدر للمصلحة',
        }]);
      }
      referenceUUID = original.uuid;
      originalIssuedAt = original.dateTimeIssued;
    }
  }

  const lineDiscount = order.lines.reduce((sum, line) => sum + Number(line.discountAmount), 0);
  const headerDiscount = Math.max(0, Number(order.discountAmount) - lineDiscount);
  const currency = (order.currencyCode || 'EGP').toUpperCase();
  const foreign = order.payments.find((row) => row.currencyCode !== 'EGP' && Number(row.exchangeRate) > 0);

  const baseSnapshot = {
    receiptType,
    issuedAt: order.postedAt ?? order.createdAt,
    now: new Date(),
    currencyCode: currency,
    exchangeRate: currency === 'EGP' ? null : foreign ? Number(foreign.exchangeRate) : null,
    headerDiscount,
    netAmount: Number(order.netAmount),
    lines: order.lines.map((line) => {
      const profile = asProfile(line.item.etaProfile);
      return {
        description: line.item.arabicName,
        internalCode: line.item.serial || line.item.barcode || line.itemId,
        itemCode: profile.itemCode || line.item.barcode || line.item.serial || null,
        itemType: profile.itemType ?? null,
        unitType: profile.unitType || line.unit.code || null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.price),
        discountAmount: Number(line.discountAmount),
        discountPercent: line.discountPercent == null ? null : Number(line.discountPercent),
        taxPercent: Number(line.taxPercent),
        taxAmount: Number(line.taxAmount),
        lineTotal: Number(line.lineTotal),
        isGift: line.isGift,
      };
    }),
    payments: order.payments.map((row) => ({
      method: row.method,
      settlementType: row.settlementType,
      amount: Math.abs(Number(row.amount)),
    })),
    paymentOverrides: setting?.paymentMap && typeof setting.paymentMap === 'object' ? (setting.paymentMap as Record<string, string>) : null,
    customer: order.customer,
    buyerThreshold: setting ? Number(setting.buyerIdentityThreshold) : ERECEIPT_LIMITS.defaultBuyerIdentityThresholdEgp,
    sellerRin,
    companyTradeName: invoiceSetting?.issuerName || order.company.arabicName,
    branchCode: device.branchCode,
    deviceSerialNumber: device.deviceSerialNumber,
    activityCode: device.activityCode || branch.activityCode || invoiceSetting?.activityCode || '',
    syndicateLicenseNumber: device.syndicateLicenseNumber,
    address: addressFrom(branch, invoiceSetting?.issuerAddress),
    enabledTypes: enabled,
    referenceUUID,
    originalIssuedAt,
    rwrReason: options?.rwr?.reason ?? null,
    rwrReasons: reasonCodes(setting?.rwrReasonCodes),
    salesIssuedDateTime: options?.rwr?.salesIssuedDateTime ?? null,
    salesOrderCode: order.orderNumber,
    paymentNumber: order.payments.map((row) => row.providerRef || row.referenceNumber).find((value) => value && value.trim())?.trim().slice(0, 30) ?? null,
    orderDeliveryMode: setting?.orderDeliveryMode ?? null,
  };

  try {
    const committed = await commitFiscalReceipt({
      companyId,
      terminalId,
      shiftId: order.shiftId,
      posOrderId,
      issueSource: 'POS',
      testClientKey: null,
      receiptType,
      generation: 1,
      snapshotBase: baseSnapshot,
      device,
      findExisting: async () => prisma.etaReceipt.findFirst({
        where: { companyId, posOrderId, generation: 1 },
        select: { id: true, uuid: true },
      }),
    });

    if (committed.kind === 'invalid') {
      const row = await persistValidationFailedReceipt({
        companyId,
        terminalId,
        shiftId: order.shiftId,
        posOrderId,
        issueSource: 'POS',
        testClientKey: null,
        receiptType,
        generation: 1,
        device,
        errors: committed.errors,
        receiptNumber: `V-${order.id}`.slice(0, 50),
        existingId: committed.existingId,
      });
      return toFiscalPublic({ ...row, validationErrors: committed.errors });
    }

    if (committed.kind === 'existing' && committed.row) {
      return toFiscalPublic(committed.row);
    }

    const issued = committed.row;
    if (!issued) {
      return toFiscalPublic({
        status: 'ATTENTION',
        validationErrors: [{ step: 'issue', propertyPath: '', errorCode: 'ISSUE', message: 'Fiscal receipt was not issued', messageAr: 'تعذر إصدار الإيصال الإلكتروني' }],
      });
    }

    logger.info(redactEreceiptLog({
      companyId,
      terminalId,
      fiscalReceiptId: issued.id,
      receiptNumber: issued.receiptNumber,
      uuid: issued.uuid,
      environment: device.environment,
      status: issued.status,
    }), 'eReceipt issued');
    if (issued.status === 'QUEUED') {
      void import('./submit.service').then((mod) => mod.drainEreceiptOutbox()).catch(() => undefined);
    }
    return toFiscalPublic(issued);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.etaReceipt.findFirst({ where: { companyId, posOrderId, generation: 1 } });
      if (existing) return toFiscalPublic(existing);
    }
    logger.error(redactEreceiptLog({ companyId, terminalId, posOrderId, message: error instanceof Error ? error.message : 'issue' }), 'eReceipt issue failed');
    return toFiscalPublic({
      status: 'ATTENTION',
      validationErrors: [{ step: 'issue', propertyPath: '', errorCode: 'ISSUE', message: 'Fiscal receipt was not issued', messageAr: 'تعذر إصدار الإيصال الإلكتروني' }],
    });
  }
}

async function persistInvalid(
  companyId: string,
  order: { id: string; shiftId: string; shift: { terminalId: string } },
  device: { environment: string; branchCode: string },
  receiptType: string,
  errors: ValidationIssue[],
  existingId?: string | null
): Promise<FiscalPublic> {
  const row = await persistValidationFailedReceipt({
    companyId,
    terminalId: order.shift.terminalId,
    shiftId: order.shiftId,
    posOrderId: order.id,
    issueSource: 'POS',
    testClientKey: null,
    receiptType,
    generation: 1,
    device,
    errors,
    receiptNumber: `V-${order.id}`.slice(0, 50),
    existingId,
  });
  return toFiscalPublic({ ...row, validationErrors: errors });
}

export async function cancelUnsubmittedReceipt(companyId: string, posOrderId: string): Promise<void> {
  await prisma.etaReceipt.updateMany({
    where: {
      companyId,
      posOrderId,
      status: { in: ['QUEUED', 'RETRYABLE', 'LATE_WINDOW', 'VALIDATION_FAILED'] },
    },
    data: { status: 'LOCAL_CANCELLED' },
  });
}
