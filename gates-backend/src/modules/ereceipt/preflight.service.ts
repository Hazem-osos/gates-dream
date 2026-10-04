import prisma from '../../shared/database/prisma';
import { buildReceiptDocument } from './document';
import { defaultEnabledReceiptTypes, issuedReceiptType, receiptTypeDefinition, RECEIPT_TYPE_REGISTRY } from './receipt-types';
import { mapReceiptPaymentMethod } from './payment-map';
import { ERECEIPT_LIMITS } from './limits';
import { asProfile, addressFrom } from './issue.service';

export type PreflightCheck = {
  code: string;
  ok: boolean;
  message: string;
  messageAr: string;
  propertyPath?: string;
};

export type EreceiptOrderHumanPreview = {
  orderNumber: string;
  orderType: string;
  receiptType: string;
  customerName: string;
  sellerName: string;
  netAmount: number;
  discountAmount: number;
  taxAmount: number;
  paymentMethods: string[];
  lines: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
  }>;
};

/** Locally knowable ETA receipt requirements before or after POS post. Does not call ETA. */
export async function preflightPosOrderReceipt(
  companyId: string,
  posOrderId: string
): Promise<{
  ready: boolean;
  checks: PreflightCheck[];
  preview?: EreceiptOrderHumanPreview;
  /** Built ETA document when validation passes (preview only — not frozen/submitted). */
  documentJson?: Record<string, unknown>;
}> {
  const checks: PreflightCheck[] = [];
  const push = (row: PreflightCheck) => {
    checks.push(row);
  };

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
  if (!order) {
    return { ready: false, checks: [{ code: 'ORDER', ok: false, message: 'POS order not found', messageAr: 'أمر البيع غير موجود' }] };
  }
  if (order.status !== 'POSTED') {
    push({ code: 'POSTED', ok: false, message: 'Order must be posted before a fiscal receipt is issued', messageAr: 'يجب ترحيل أمر البيع قبل إصدار الإيصال' });
  }
  if (order.orderType !== 'SALE' && order.orderType !== 'RETURN') {
    push({ code: 'ORDER_TYPE', ok: false, message: 'This order type does not produce an ETA receipt', messageAr: 'نوع الأمر لا يصدر إيصالًا إلكترونيًا' });
  }

  const terminalId = order.shift.terminalId;
  const devices = await prisma.etaReceiptDevice.findMany({ where: { companyId, terminalId, active: true } });
  push({
    code: 'ETA_DEVICE',
    ok: devices.length > 0,
    message: devices.length > 0 ? 'ETA device configured' : 'No active ETA device on this terminal',
    messageAr: devices.length > 0 ? 'جهاز المصلحة مضبوط' : 'لا يوجد جهاز مصلحة مفعّل على هذه النقطة',
  });

  const settings = await prisma.etaReceiptSetting.findMany({ where: { companyId } });
  const device = settings.length
    ? devices.find((row) => settings.some((setting) => setting.environment === row.environment)) ?? null
    : devices.length === 1
      ? devices[0]
      : null;
  if (devices.length > 0 && !device) {
    push({
      code: 'ENVIRONMENT',
      ok: false,
      message: 'More than one ETA environment is active for this terminal',
      messageAr: 'أكثر من بيئة مصلحة مفعّلة لهذا الجهاز',
    });
  }

  const invoiceSetting = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
  const sellerRin = (invoiceSetting?.issuerTaxId || order.company.taxNumber1 || '').replace(/\D/g, '').slice(0, 9);
  push({
    code: 'RIN',
    ok: /^\d{9}$/.test(sellerRin),
    message: /^\d{9}$/.test(sellerRin) ? 'Issuer RIN present' : 'Issuer registration number is missing or invalid',
    messageAr: /^\d{9}$/.test(sellerRin) ? 'رقم تسجيل البائع موجود' : 'رقم تسجيل البائع ناقص أو غير صالح',
  });

  if (device) {
    push({
      code: 'BRANCH',
      ok: Boolean(device.branchCode),
      message: device.branchCode ? 'Branch code present' : 'Branch code missing on device',
      messageAr: device.branchCode ? 'كود الفرع موجود' : 'كود الفرع ناقص على الجهاز',
    });
    push({
      code: 'ACTIVITY',
      ok: Boolean(device.activityCode),
      message: device.activityCode ? 'Activity code present' : 'Activity code missing on device',
      messageAr: device.activityCode ? 'كود النشاط موجود' : 'كود النشاط ناقص على الجهاز',
    });
    push({
      code: 'POS_SERIAL',
      ok: Boolean(device.deviceSerialNumber && device.posOsVersion && device.posModelFramework && device.posModelFramework.length <= 10),
      message: 'POS serial, OS version and model framework',
      messageAr: 'مسلسل الجهاز وإصدار النظام وإطار الجهاز',
    });
    const chain = await prisma.etaReceiptChain.findUnique({
      where: { companyId_terminalId_environment: { companyId, terminalId, environment: device.environment } },
    });
    push({
      code: 'CHAIN',
      ok: true,
      message: chain ? 'Device previousUUID chain is available' : 'First receipt on this device will use an empty previousUUID',
      messageAr: chain ? 'سلسلة previousUUID للجهاز متاحة' : 'أول إيصال على هذا الجهاز سيستخدم previousUUID فارغًا',
    });
  }

  const setting = device ? settings.find((row) => row.environment === device.environment) ?? null : null;
  const enabled = Array.isArray(setting?.enabledReceiptTypes)
    ? (setting?.enabledReceiptTypes as string[])
    : defaultEnabledReceiptTypes();
  let receiptType = order.orderType === 'RETURN' ? issuedReceiptType('return', enabled) : issuedReceiptType('sale', enabled);
  let referenceUUID: string | null = null;
  let originalIssuedAt: Date | null = null;
  if (order.orderType === 'RETURN' && order.originalOrderId && device) {
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
    referenceUUID = original?.uuid ?? null;
    originalIssuedAt = original?.dateTimeIssued ?? null;
    push({
      code: 'RETURN_REFERENCE',
      ok: Boolean(referenceUUID),
      message: referenceUUID ? 'Original sale receipt UUID is available' : 'Original sale has no frozen ETA receipt',
      messageAr: referenceUUID ? 'UUID إيصال البيع الأصلي متاح' : 'إيصال البيع الأصلي غير مُصدر للمصلحة',
    });
  }

  const definition = receiptTypeDefinition(receiptType);
  if (definition?.orderDeliveryMode === 'required' && !setting?.orderDeliveryMode) {
    push({
      code: 'DELIVERY_MODE',
      ok: false,
      message: `Receipt type ${receiptType} requires order delivery mode in company settings`,
      messageAr: `نوع الإيصال ${receiptType} يحتاج طريقة تسليم في إعدادات الشركة`,
    });
  }

  order.payments.forEach((row) => {
    const mapped = mapReceiptPaymentMethod(
      [{ method: row.method, settlementType: row.settlementType, amount: Math.abs(Number(row.amount)) }],
      setting?.paymentMap && typeof setting.paymentMap === 'object' ? (setting.paymentMap as Record<string, string>) : null
    );
    if (!mapped.code) {
      push({
        code: 'PAYMENT',
        ok: false,
        message: `Payment method ${row.method} has no ETA mapping`,
        messageAr: `طريقة الدفع ${row.method} بلا ربط بكود المصلحة`,
      });
    }
  });

  order.lines.forEach((line, index) => {
    const profile = asProfile(line.item.etaProfile);
    const rawCode = profile.itemCode || line.item.barcode || line.item.serial || '';
    if (!rawCode) {
      push({
        code: 'ITEM_CODE',
        ok: false,
        propertyPath: `itemData[${index}]`,
        message: `Line ${index + 1} has no GS1 or EGS code`,
        messageAr: `البند ${index + 1} بلا كود GS1 أو EGS`,
      });
    }
    const unitType = String(profile.unitType || line.unit.code || '').trim();
    if (!/^[A-Z0-9]{1,10}$/.test(unitType.toUpperCase())) {
      push({
        code: 'UNIT',
        ok: false,
        propertyPath: `itemData[${index}].unitType`,
        message: `Line ${index + 1} has no valid ETA unit code`,
        messageAr: `البند ${index + 1} بلا وحدة قياس صالحة للمصلحة`,
      });
    }
  });

  if (device && order.status === 'POSTED') {
    const branch = order.shift.terminal.branch;
    const lineDiscount = order.lines.reduce((sum, line) => sum + Number(line.discountAmount), 0);
    const headerDiscount = Math.max(0, Number(order.discountAmount) - lineDiscount);
    const currency = (order.currencyCode || 'EGP').toUpperCase();
    const foreign = order.payments.find((row) => row.currencyCode !== 'EGP' && Number(row.exchangeRate) > 0);
    const built = buildReceiptDocument({
      receiptType,
      receiptNumber: 'PREFLIGHT',
      previousUUID: '',
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
      orderDeliveryMode: setting?.orderDeliveryMode ?? null,
      paymentNumber: order.payments.map((row) => row.providerRef || row.referenceNumber).find((value) => value && value.trim())?.trim().slice(0, 30) ?? null,
      salesOrderCode: order.orderNumber,
    });
    for (const issue of built.errors) {
      push({
        code: issue.errorCode,
        ok: false,
        propertyPath: issue.propertyPath,
        message: issue.message,
        messageAr: issue.messageAr,
      });
    }
    if (built.document) {
      push({ code: 'TOTALS', ok: true, message: 'Receipt totals reconcile to the posted order', messageAr: 'إجماليات الإيصال تطابق أمر البيع' });
      push({ code: 'BUYER', ok: true, message: 'Buyer rules satisfied for this receipt', messageAr: 'قواعد المشتري مستوفاة' });
    }
    const taxAmount = order.lines.reduce((sum, line) => sum + Number(line.taxAmount), 0);
    const preview: EreceiptOrderHumanPreview = {
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      receiptType,
      customerName: order.customer?.arabicName || order.customer?.englishName || '—',
      sellerName: invoiceSetting?.issuerName || order.company.arabicName,
      netAmount: Number(order.netAmount),
      discountAmount: Number(order.discountAmount),
      taxAmount,
      paymentMethods: order.payments.map((row) => row.method),
      lines: order.lines.map((line) => ({
        name: line.item.arabicName,
        quantity: Number(line.quantity),
        unitPrice: Number(line.price),
        discountAmount: Number(line.discountAmount),
        taxAmount: Number(line.taxAmount),
        lineTotal: Number(line.lineTotal),
      })),
    };
    const ready = checks.every((row) => row.ok);
    return {
      ready,
      checks,
      preview,
      documentJson: built.document ?? undefined,
    };
  }

  const ready = checks.every((row) => row.ok);
  return { ready, checks };
}
