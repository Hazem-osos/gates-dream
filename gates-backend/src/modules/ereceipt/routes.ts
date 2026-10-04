import { Router, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../shared/middleware/tenant-fiscal-context.middleware';
import type { AuthRequest } from '../../shared/auth/types';
import prisma from '../../shared/database/prisma';
import { encrypt } from '../../shared/security/secrets-manager';
import { logger } from '../../shared/logger';
import { defaultEnabledReceiptTypes, RECEIPT_TYPE_REGISTRY } from './receipt-types';
import { ERECEIPT_LIMITS } from './limits';
import { issuePostedPosReceipt } from './issue.service';
import { correctInvalidReceipt, recordLateReason } from './correction.service';
import { drainEreceiptOutbox, syncReceiptStatus } from './submit.service';
import { preflightPosOrderReceipt } from './preflight.service';
import { testEreceiptConnection } from './connection-test.service';
import { validateImportedReceiptJson } from './import-validate.service';
import { redactEreceiptLog } from './errors';
import {
  issuePreproductionTestReceipt,
  loadTestReceiptContext,
  previewPreproductionTestReceipt,
  assertPreproductionTestAllowed,
  type TestReceiptInput,
} from './test-receipt.service';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

function companyIdOf(req: AuthRequest): string | undefined {
  return req.companyId ?? req.tenantId;
}

function rejectProductionManualTest(req: AuthRequest, res: Response): boolean {
  const env = String(req.body?.environment ?? req.query?.environment ?? '').trim().toUpperCase();
  if (env === 'PRODUCTION') {
    res.status(403).json({ status: 'error', message: 'إنشاء الإيصال التجريبي غير متاح في بيئة PRODUCTION' });
    return true;
  }
  try {
    assertPreproductionTestAllowed(env || 'PREPRODUCTION');
  } catch {
    res.status(403).json({ status: 'error', message: 'إنشاء الإيصال التجريبي غير متاح في بيئة PRODUCTION' });
    return true;
  }
  return false;
}

router.get('/test/context', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  if (rejectProductionManualTest(req, res)) return;
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  try {
    const data = await loadTestReceiptContext(companyId);
    if (!data.ok) return void res.status(422).json({ status: 'error', message: data.messageAr });
    return void res.json({ status: 'success', data });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    return void res.status(statusCode).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر التحميل' });
  }
});

router.get('/test/items', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  if (rejectProductionManualTest(req, res)) return;
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const q = String(req.query.q ?? '').trim();
  const rows = await prisma.item.findMany({
    where: {
      companyId,
      inactiveItem: false,
      ...(q ? { OR: [{ arabicName: { contains: q } }, { barcode: { contains: q } }, { serial: { contains: q } }] } : {}),
    },
    take: 20,
    select: { id: true, arabicName: true, barcode: true, serial: true, etaProfile: true, defaultTaxPercent: true },
  });
  return void res.json({ status: 'success', data: rows });
});

router.post('/test/preview', authorize({ resource: 'ereceipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  if (rejectProductionManualTest(req, res)) return;
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const body = req.body as TestReceiptInput;
  const data = await previewPreproductionTestReceipt(companyId, body);
  return void res.json({ status: 'success', data });
});

router.post('/test/issue', authorize({ resource: 'ereceipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  if (rejectProductionManualTest(req, res)) return;
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const body = req.body as TestReceiptInput;
  const preview = await previewPreproductionTestReceipt(companyId, body);
  if (!preview.ready) {
    return void res.status(422).json({
      status: 'error',
      message: 'تعذر إنشاء الإيصال — راجع أخطاء التحقق',
      data: preview,
    });
  }
  const fiscal = await issuePreproductionTestReceipt(companyId, body);
  return void res.json({ status: 'success', data: fiscal });
});

router.get('/dashboard', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const grouped = await prisma.etaReceipt.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } });
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  const oldest = await prisma.etaReceipt.findFirst({
    where: { companyId, status: { in: ['QUEUED', 'RETRYABLE', 'LATE_WINDOW'] } },
    orderBy: { dateTimeIssued: 'asc' },
    select: { dateTimeIssued: true, receiptNumber: true, status: true },
  });
  const lastValid = await prisma.etaReceipt.findFirst({
    where: { companyId, status: 'VALID' },
    orderBy: { dateTimeValidated: 'desc' },
    select: { dateTimeValidated: true },
  });
  return void res.json({
    status: 'success',
    data: {
      counts,
      oldestPending: oldest,
      lastValidAt: lastValid?.dateTimeValidated ?? null,
    },
  });
});

router.get('/receipts', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const status = String(req.query.status ?? '').trim();
  const q = String(req.query.q ?? '').trim();
  const take = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const rows = await prisma.etaReceipt.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { receiptNumber: { contains: q } },
              { uuid: { contains: q } },
              { etaLongId: { contains: q } },
              { posOrder: { orderNumber: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      receiptNumber: true,
      receiptType: true,
      uuid: true,
      etaLongId: true,
      status: true,
      environment: true,
      dateTimeIssued: true,
      posOrderId: true,
      terminalId: true,
      etaSubmissionUuid: true,
      previousUUID: true,
      referenceUUID: true,
      referenceOldUUID: true,
      issueSource: true,
      frozenJson: true,
      posOrder: { select: { orderNumber: true, netAmount: true } },
    },
  });
  const data = rows.map((row) => {
    const frozen = row.frozenJson && typeof row.frozenJson === 'object' ? (row.frozenJson as { totalAmount?: number }) : null;
    const { frozenJson: _omit, ...rest } = row;
    return {
      ...rest,
      totalAmount: frozen?.totalAmount ?? row.posOrder?.netAmount ?? null,
      isTestReceipt: row.issueSource === 'PREPRODUCTION_TEST',
    };
  });
  return void res.json({ status: 'success', data });
});

router.get('/receipts/:id', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const row = await prisma.etaReceipt.findFirst({
    where: { id: req.params.id, companyId },
    include: {
      attempts: { orderBy: { createdAt: 'desc' }, take: 20 },
      correctedFrom: { select: { id: true, uuid: true, status: true, receiptNumber: true } },
      corrections: { select: { id: true, uuid: true, status: true, receiptNumber: true } },
      posOrder: { select: { id: true, orderNumber: true, orderType: true, netAmount: true, originalOrderId: true } },
    },
  });
  if (!row) return void res.status(404).json({ status: 'error', message: 'الإيصال غير موجود' });
  return void res.json({ status: 'success', data: row });
});

router.get('/submissions', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const rows = await prisma.etaReceiptSubmission.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return void res.json({ status: 'success', data: rows });
});

router.post('/test-connection', authorize({ resource: 'ereceipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const environment = req.body?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'PREPRODUCTION';
  const terminalId = req.body?.terminalId ? String(req.body.terminalId) : undefined;
  const data = await testEreceiptConnection(companyId, { environment, terminalId });
  logger.info(
    redactEreceiptLog({ companyId, environment, terminalId, ok: data.ok, action: 'ERECEIPT_TEST_CONNECTION' }),
    'eReceipt connection test'
  );
  return void res.json({ status: 'success', data });
});

router.post('/import/validate', authorize({ resource: 'ereceipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = validateImportedReceiptJson(req.body?.document ?? req.body);
  return void res.json({ status: 'success', data: { ...data, companyId } });
});

router.post('/orders/:posOrderId/issue-test', authorize({ resource: 'ereceipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const order = await prisma.posOrder.findFirst({
    where: { id: req.params.posOrderId, companyId },
    include: { shift: { select: { terminalId: true } } },
  });
  if (!order || order.status !== 'POSTED') {
    return void res.status(422).json({ status: 'error', message: 'أمر البيع غير مرحّل أو غير موجود' });
  }
  const device = await prisma.etaReceiptDevice.findFirst({
    where: { companyId, terminalId: order.shift.terminalId, environment: 'PREPRODUCTION', active: true },
  });
  if (!device) {
    return void res.status(422).json({
      status: 'error',
      message: 'إرسال الإيصال التجريبي متاح فقط مع جهاز مفعّل في بيئة PREPRODUCTION',
    });
  }
  const pre = await preflightPosOrderReceipt(companyId, req.params.posOrderId);
  if (!pre.ready) {
    return void res.status(422).json({
      status: 'error',
      message: 'المعاينة لم تنجح — أصلح الأخطاء قبل الإرسال',
      data: { checks: pre.checks.filter((row) => !row.ok) },
    });
  }
  const fiscal = await issuePostedPosReceipt(companyId, req.params.posOrderId);
  void drainEreceiptOutbox().catch(() => undefined);
  return void res.json({ status: 'success', data: fiscal });
});

router.get('/orders/:posOrderId/preflight', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await preflightPosOrderReceipt(companyId, req.params.posOrderId);
  return void res.json({ status: 'success', data });
});

router.get('/readiness', authorize({ resource: 'ereceipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const [company, settings, devices, invoice] = await Promise.all([
    prisma.company.findFirst({ where: { id: companyId }, select: { taxNumber1: true, arabicName: true } }),
    prisma.etaReceiptSetting.findMany({ where: { companyId } }),
    prisma.etaReceiptDevice.findMany({
      where: { companyId },
      select: {
        id: true,
        terminalId: true,
        environment: true,
        deviceSerialNumber: true,
        branchCode: true,
        posOsVersion: true,
        posModelFramework: true,
        activityCode: true,
        active: true,
        clientId: true,
        presharedKeyEnc: true,
        clientSecretEnc: true,
        terminal: { select: { name: true } },
      },
    }),
    prisma.eInvoiceSetting.findUnique({ where: { companyId }, select: { issuerTaxId: true, environment: true } }),
  ]);
  const rin = (invoice?.issuerTaxId || company?.taxNumber1 || '').replace(/\D/g, '');
  const checks = [
    { code: 'RIN', ok: /^\d{9}$/.test(rin), messageAr: 'رقم التسجيل الضريبي' },
    { code: 'DEVICE', ok: devices.some((row) => row.active), messageAr: 'جهاز نقطة بيع مفعّل للمصلحة' },
    { code: 'SERIAL', ok: devices.some((row) => row.active && row.deviceSerialNumber && row.branchCode && row.posOsVersion && row.posModelFramework), messageAr: 'مسلسل الفرع ونظام الجهاز' },
    { code: 'ACTIVITY', ok: devices.some((row) => row.active && row.activityCode), messageAr: 'كود النشاط على الجهاز' },
  ];
  const devicesSafe = devices.map(
    ({ presharedKeyEnc, clientSecretEnc, ...device }) => ({
      ...device,
      clientSecretConfigured: Boolean(clientSecretEnc),
      presharedKeyConfigured: Boolean(presharedKeyEnc),
    })
  );
  return void res.json({
    status: 'success',
    data: {
      checks,
      devices: devicesSafe,
      settings,
      receiptTypes: RECEIPT_TYPE_REGISTRY,
      limits: ERECEIPT_LIMITS,
    },
  });
});

router.put('/settings', authorize({ resource: 'ereceipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const environment = req.body?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'PREPRODUCTION';
  const row = await prisma.etaReceiptSetting.upsert({
    where: { companyId_environment: { companyId, environment } },
    create: {
      companyId,
      environment,
      buyerIdentityThreshold: Number(req.body?.buyerIdentityThreshold ?? ERECEIPT_LIMITS.defaultBuyerIdentityThresholdEgp),
      enabledReceiptTypes: Array.isArray(req.body?.enabledReceiptTypes) ? req.body.enabledReceiptTypes : defaultEnabledReceiptTypes(),
      paymentMap: req.body?.paymentMap ?? Prisma.JsonNull,
      rwrReasonCodes: req.body?.rwrReasonCodes ?? Prisma.JsonNull,
      orderDeliveryMode: req.body?.orderDeliveryMode ? String(req.body.orderDeliveryMode).slice(0, 30) : null,
      signingMode: req.body?.signingMode === 'REQUIRED' ? 'REQUIRED' : 'DISABLED',
    },
    update: {
      buyerIdentityThreshold: req.body?.buyerIdentityThreshold == null ? undefined : Number(req.body.buyerIdentityThreshold),
      enabledReceiptTypes: Array.isArray(req.body?.enabledReceiptTypes) ? req.body.enabledReceiptTypes : undefined,
      paymentMap: req.body?.paymentMap,
      rwrReasonCodes: req.body?.rwrReasonCodes,
      orderDeliveryMode: req.body?.orderDeliveryMode === undefined ? undefined : (req.body.orderDeliveryMode ? String(req.body.orderDeliveryMode).slice(0, 30) : null),
      signingMode: req.body?.signingMode === 'REQUIRED' ? 'REQUIRED' : req.body?.signingMode === 'DISABLED' ? 'DISABLED' : undefined,
    },
  });
  logger.info(redactEreceiptLog({ companyId, environment, userId: req.user?.sub, action: 'ERECEIPT_SETTINGS' }), 'eReceipt settings updated');
  return void res.json({ status: 'success', data: row });
});

router.put('/devices/:terminalId', authorize({ resource: 'ereceipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const terminal = await prisma.posTerminal.findFirst({ where: { id: req.params.terminalId, companyId }, select: { id: true } });
  if (!terminal) return void res.status(404).json({ status: 'error', message: 'نقطة البيع غير موجودة' });
  const environment = req.body?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'PREPRODUCTION';
  const existing = await prisma.etaReceiptDevice.findFirst({ where: { companyId, terminalId: terminal.id, environment } });
  const preshared = String(req.body?.presharedKey ?? '').trim();
  const secret = String(req.body?.clientSecret ?? '').trim();
  if (!existing && (!preshared || !secret)) {
    return void res.status(422).json({ status: 'error', message: 'مفتاح الجهاز وسر العميل مطلوبان عند أول حفظ' });
  }
  const framework = String(req.body?.posModelFramework ?? existing?.posModelFramework ?? '');
  if (framework.length > 10) {
    return void res.status(422).json({ status: 'error', message: 'إطار الجهاز أطول من 10 أحرف حسب توثيق المصلحة' });
  }
  const data = {
    companyId,
    terminalId: terminal.id,
    environment,
    deviceSerialNumber: String(req.body?.deviceSerialNumber ?? existing?.deviceSerialNumber ?? '').slice(0, 100),
    branchCode: String(req.body?.branchCode ?? existing?.branchCode ?? '').slice(0, 50),
    posOsVersion: String(req.body?.posOsVersion ?? existing?.posOsVersion ?? '').slice(0, 50),
    posModelFramework: framework,
    activityCode: req.body?.activityCode ? String(req.body.activityCode).slice(0, 10) : existing?.activityCode,
    syndicateLicenseNumber: req.body?.syndicateLicenseNumber ? String(req.body.syndicateLicenseNumber).slice(0, 30) : existing?.syndicateLicenseNumber,
    clientId: String(req.body?.clientId ?? existing?.clientId ?? '').slice(0, 200),
    presharedKeyEnc: preshared ? encrypt(preshared) : existing?.presharedKeyEnc ?? '',
    clientSecretEnc: secret ? encrypt(secret) : existing?.clientSecretEnc ?? '',
    active: Boolean(req.body?.active),
  };
  const row = existing
    ? await prisma.etaReceiptDevice.update({ where: { id: existing.id }, data })
    : await prisma.etaReceiptDevice.create({ data });
  logger.info(redactEreceiptLog({ companyId, terminalId: terminal.id, environment, userId: req.user?.sub, action: 'ERECEIPT_DEVICE' }), 'eReceipt device saved');
  return void res.json({
    status: 'success',
    data: {
      id: row.id,
      terminalId: row.terminalId,
      environment: row.environment,
      deviceSerialNumber: row.deviceSerialNumber,
      branchCode: row.branchCode,
      posOsVersion: row.posOsVersion,
      posModelFramework: row.posModelFramework,
      activityCode: row.activityCode,
      clientId: row.clientId,
      active: row.active,
      secretsConfigured: true,
    },
  });
});

router.post('/receipts/:id/retry', authorize({ resource: 'ereceipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const updated = await prisma.etaReceipt.updateMany({
    where: { id: req.params.id, companyId, status: { in: ['RETRYABLE', 'CONFIG_FAILED', 'LATE_WINDOW'] }, uuid: { not: null } },
    data: { status: 'QUEUED', nextAttemptAt: null },
  });
  if (updated.count !== 1) return void res.status(409).json({ status: 'error', message: 'لا يمكن إعادة إرسال هذا الإيصال' });
  logger.info({ companyId, fiscalReceiptId: req.params.id, userId: req.user?.sub, action: 'ERECEIPT_RETRY' }, 'eReceipt retry queued');
  void drainEreceiptOutbox().catch(() => undefined);
  return void res.json({ status: 'success' });
});

router.post('/receipts/:id/sync', authorize({ resource: 'ereceipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await syncReceiptStatus(companyId, req.params.id);
  return void res.json({ status: 'success', data });
});

router.post('/receipts/:id/correct', authorize({ resource: 'ereceipt', action: 'approve' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await correctInvalidReceipt(companyId, req.params.id, req.body ?? {});
  logger.info({ companyId, fiscalReceiptId: req.params.id, userId: req.user?.sub, action: 'ERECEIPT_CORRECT' }, 'eReceipt correction requested');
  void drainEreceiptOutbox().catch(() => undefined);
  return void res.json({ status: 'success', data });
});

router.post('/receipts/:id/late', authorize({ resource: 'ereceipt', action: 'approve' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) return void res.status(422).json({ status: 'error', message: 'سبب التأخير مطلوب' });
  const data = await recordLateReason(companyId, req.params.id, reason);
  return void res.json({ status: 'success', data });
});

router.post('/orders/:posOrderId/rwr', authorize({ resource: 'ereceipt', action: 'approve' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await issuePostedPosReceipt(companyId, req.params.posOrderId, {
    rwr: { reason: String(req.body?.reason ?? ''), salesIssuedDateTime: String(req.body?.salesIssuedDateTime ?? '') },
  });
  return void res.json({ status: 'success', data });
});

router.post('/queue/drain', authorize({ resource: 'ereceipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await drainEreceiptOutbox();
  return void res.json({ status: 'success', data });
});

export default router;
