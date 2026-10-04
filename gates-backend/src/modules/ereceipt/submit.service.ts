import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { logger } from '../../shared/logger';
import { decrypt } from '../../shared/security/secrets-manager';
import { getPosAccessToken, clearPosTokenCache } from './auth';
import { packSubmissionBatches, submissionBody } from './batch';
import { classifySubmissionFailure, redactEreceiptLog, retryDelayMs } from './errors';
import { ereceiptRequest } from './http';
import { ERECEIPT_LIMITS, ERECEIPT_PATHS } from './limits';

type DueReceipt = {
  id: string;
  companyId: string;
  terminalId: string;
  environment: string;
  status: string;
  submitText: string | null;
  uuid: string | null;
  attemptCount: number;
  receiptNumber: string;
  lateReason: string | null;
};

let draining = false;

export async function drainEreceiptOutbox(): Promise<{ claimed: number }> {
  if (draining) return { claimed: 0 };
  draining = true;
  try {
    const staleBefore = new Date(Date.now() - ERECEIPT_LIMITS.staleSubmittingMs);
    await prisma.etaReceipt.updateMany({
      where: { status: 'SUBMITTING', updatedAt: { lt: staleBefore } },
      data: { status: 'RETRYABLE', lastErrorClass: 'RETRYABLE', lastError: 'Submission stopped before an ETA response' },
    });
    const due = await prisma.etaReceipt.findMany({
      where: {
        status: { in: ['QUEUED', 'RETRYABLE'] },
        submitText: { not: null },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { dateTimeIssued: 'asc' },
      take: ERECEIPT_LIMITS.maxReceiptsPerSubmission,
    });
    const groups = new Map<string, DueReceipt[]>();
    for (const row of due) {
      const key = `${row.companyId}:${row.terminalId}:${row.environment}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    let claimed = 0;
    for (const rows of groups.values()) claimed += await submitGroup(rows);
    return { claimed };
  } finally {
    draining = false;
  }
}

async function submitGroup(rows: DueReceipt[]): Promise<number> {
  const claimed: DueReceipt[] = [];
  for (const row of rows) {
    const updated = await prisma.etaReceipt.updateMany({
      where: { id: row.id, companyId: row.companyId, status: row.status },
      data: { status: 'SUBMITTING' },
    });
    if (updated.count === 1 && row.submitText && row.uuid) claimed.push(row);
  }
  if (claimed.length === 0) return 0;
  const first = claimed[0];
  const setting = await prisma.etaReceiptSetting.findFirst({
    where: { companyId: first.companyId, environment: first.environment },
  });
  if (setting?.signingMode === 'REQUIRED') {
    await markGroup(claimed, 'CONFIG_FAILED', 'CONFIG', 'Receipt batch signing is required and no signature was attached');
    return claimed.length;
  }
  if (claimed.some((row) => row.lateReason)) clearPosTokenCache();
  const device = await prisma.etaReceiptDevice.findFirst({
    where: { companyId: first.companyId, terminalId: first.terminalId, environment: first.environment, active: true },
  });
  if (!device) {
    await markGroup(claimed, 'CONFIG_FAILED', 'CONFIG', 'ETA device is not active');
    return claimed.length;
  }
  let secret = '';
  let preshared = '';
  try {
    secret = decrypt(device.clientSecretEnc);
    preshared = decrypt(device.presharedKeyEnc);
  } catch {
    await markGroup(claimed, 'CONFIG_FAILED', 'CONFIG', 'ETA device secret could not be read');
    return claimed.length;
  }
  const token = await getPosAccessToken({
    companyId: first.companyId,
    terminalId: first.terminalId,
    environment: first.environment,
    clientId: device.clientId,
    clientSecret: secret,
    posSerial: device.deviceSerialNumber,
    posOsVersion: device.posOsVersion,
    posModelFramework: device.posModelFramework,
    presharedKey: preshared,
  });
  if ('error' in token) {
    const klass = classifySubmissionFailure({ httpStatus: 401, errorCode: token.errorCode, message: token.error });
    const status = klass === 'CONFIG' ? 'CONFIG_FAILED' : 'RETRYABLE';
    await markGroup(claimed, status, klass, token.errorCode || token.error, klass === 'RETRYABLE' ? retryDelayMs(null, 1) : null);
    return claimed.length;
  }
  const batches = packSubmissionBatches(claimed.map((row) => row.submitText as string));
  let offset = 0;
  for (const texts of batches) {
    const slice = claimed.slice(offset, offset + texts.length);
    offset += texts.length;
    await postBatch(slice, token.accessToken, submissionBody(texts));
  }
  return claimed.length;
}

async function postBatch(rows: DueReceipt[], accessToken: string, body: string): Promise<void> {
  const first = rows[0];
  const submission = await prisma.etaReceiptSubmission.create({
    data: {
      companyId: first.companyId,
      terminalId: first.terminalId,
      environment: first.environment,
      status: 'SUBMITTING',
      receiptCount: rows.length,
      payloadBytes: Buffer.byteLength(body, 'utf8'),
    },
  });
  const result = await ereceiptRequest({
    environment: first.environment,
    path: ERECEIPT_PATHS.submit,
    method: 'POST',
    token: accessToken,
    body,
  });
  const payload = (result.body ?? {}) as {
    submissionUUID?: string;
    submissionId?: string;
    error?: string | { code?: string; message?: string };
    acceptedDocuments?: Array<{ uuid?: string; longId?: string; receiptNumber?: string }>;
    rejectedDocuments?: Array<{ uuid?: string; receiptNumber?: string; error?: { code?: string; message?: string; details?: unknown[] } }>;
  };
  const errorCode = typeof payload.error === 'string' ? payload.error : payload.error?.code;
  const errorMessage = typeof payload.error === 'string' ? payload.error : payload.error?.message;
  if (result.status !== 202) {
    const klass = classifySubmissionFailure({ httpStatus: result.status, errorCode, message: errorMessage });
    const status = klass === 'DUPLICATE' || klass === 'RETRYABLE' ? 'RETRYABLE' : klass === 'CONFIG' ? 'CONFIG_FAILED' : 'INVALID';
    const delay = status === 'RETRYABLE' ? retryDelayMs(result.retryAfter, rows[0].attemptCount + 1) : null;
    await prisma.etaReceiptSubmission.update({
      where: { id: submission.id },
      data: { status, response: payload as Prisma.InputJsonValue },
    });
    await markGroup(rows, status, klass, errorMessage || errorCode || `HTTP ${result.status}`, delay, submission.id, result.status);
    logger.info(redactEreceiptLog({
      companyId: first.companyId,
      terminalId: first.terminalId,
      environment: first.environment,
      submissionId: submission.id,
      status,
      httpStatus: result.status,
    }), 'eReceipt batch was not accepted');
    return;
  }
  const submissionUuid = payload.submissionUUID || payload.submissionId || null;
  const accepted = new Map((payload.acceptedDocuments ?? []).map((row) => [row.uuid, row]));
  const rejected = new Map((payload.rejectedDocuments ?? []).map((row) => [row.uuid, row]));
  for (const row of rows) {
    const ok = row.uuid ? accepted.get(row.uuid) : undefined;
    const bad = row.uuid ? rejected.get(row.uuid) : undefined;
    const status = bad ? 'INVALID' : 'SUBMITTED';
    await prisma.etaReceipt.update({
      where: { id: row.id },
      data: {
        status,
        submissionId: submission.id,
        etaSubmissionUuid: submissionUuid,
        etaLongId: ok?.longId ?? null,
        etaErrors: bad ? (bad as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        lastError: bad?.error?.message ?? null,
        lastErrorClass: bad ? 'PERMANENT' : null,
        attemptCount: { increment: 1 },
        dateTimeSubmitted: new Date(),
        nextAttemptAt: null,
      },
    });
    await prisma.etaReceiptAttempt.create({
      data: {
        companyId: row.companyId,
        receiptId: row.id,
        submissionId: submission.id,
        attempt: row.attemptCount + 1,
        status,
        httpStatus: result.status,
        errorClass: bad ? 'PERMANENT' : null,
        message: bad?.error?.message ?? null,
      },
    });
  }
  await prisma.etaReceiptSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'SUBMITTED',
      submissionUuid,
      acceptedCount: payload.acceptedDocuments?.length ?? 0,
      rejectedCount: payload.rejectedDocuments?.length ?? 0,
      response: payload as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });
  logger.info(redactEreceiptLog({
    companyId: first.companyId,
    terminalId: first.terminalId,
    environment: first.environment,
    submissionUUID: submissionUuid,
    count: rows.length,
    status: 'SUBMITTED',
  }), 'eReceipt batch accepted for async validation');
}

async function markGroup(
  rows: DueReceipt[],
  status: string,
  errorClass: string,
  message: string,
  delayMs: number | null = null,
  submissionId?: string,
  httpStatus?: number
): Promise<void> {
  const nextAttemptAt = delayMs == null ? null : new Date(Date.now() + delayMs);
  for (const row of rows) {
    await prisma.etaReceipt.update({
      where: { id: row.id },
      data: {
        status,
        lastError: message.slice(0, 500),
        lastErrorClass: errorClass,
        attemptCount: { increment: 1 },
        nextAttemptAt,
        submissionId: submissionId ?? undefined,
      },
    });
    await prisma.etaReceiptAttempt.create({
      data: {
        companyId: row.companyId,
        receiptId: row.id,
        submissionId: submissionId ?? null,
        attempt: row.attemptCount + 1,
        status,
        httpStatus: httpStatus ?? null,
        errorClass,
        message: message.slice(0, 500),
      },
    });
  }
}

export function flattenEtaErrors(body: unknown): Array<{ step: string; propertyPath: string; errorCode: string; message: string; messageAr: string }> {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const results = root.validationResults && typeof root.validationResults === 'object'
    ? (root.validationResults as Record<string, unknown>)
    : root;
  const steps = Array.isArray(results.validationSteps) ? results.validationSteps : [];
  const errors: Array<{ step: string; propertyPath: string; errorCode: string; message: string; messageAr: string }> = [];
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const row = step as Record<string, unknown>;
    const name = String(row.name ?? row.stepName ?? 'validation');
    const list = Array.isArray(row.errors) ? row.errors : [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const error = item as Record<string, unknown>;
      const inner = Array.isArray(error.innerError) ? error.innerError : [];
      const message = String(error.message ?? error.error ?? '');
      const arabic = String(error.messageAr ?? inner.map((entry) => (entry && typeof entry === 'object' ? (entry as { error?: string }).error : '')).filter(Boolean).join(' ') ?? '');
      errors.push({
        step: name,
        propertyPath: String(error.propertyPath ?? error.target ?? ''),
        errorCode: String(error.errorCode ?? error.code ?? ''),
        message,
        messageAr: arabic || message,
      });
    }
  }
  return errors;
}

export async function syncReceiptStatus(companyId: string, receiptId: string): Promise<{ status: string }> {
  const row = await prisma.etaReceipt.findFirst({ where: { id: receiptId, companyId } });
  if (!row?.uuid) return { status: row?.status ?? 'MISSING' };
  const device = await prisma.etaReceiptDevice.findFirst({
    where: { companyId, terminalId: row.terminalId, environment: row.environment, active: true },
  });
  if (!device) return { status: row.status };
  const token = await getPosAccessToken({
    companyId,
    terminalId: row.terminalId,
    environment: row.environment,
    clientId: device.clientId,
    clientSecret: decrypt(device.clientSecretEnc),
    posSerial: device.deviceSerialNumber,
    posOsVersion: device.posOsVersion,
    posModelFramework: device.posModelFramework,
    presharedKey: decrypt(device.presharedKeyEnc),
  });
  if ('error' in token) return { status: row.status };
  const path = row.etaSubmissionUuid && row.status === 'SUBMITTED'
    ? ERECEIPT_PATHS.submission(row.etaSubmissionUuid)
    : ERECEIPT_PATHS.details(row.uuid);
  const result = await ereceiptRequest({
    environment: row.environment,
    path,
    method: 'GET',
    token: token.accessToken,
  });
  const body = result.body as { status?: string; receipt?: { status?: string } };
  const remote = String(body.receipt?.status ?? body.status ?? '').toLowerCase();
  const next = remote === 'valid' ? 'VALID' : remote === 'invalid' ? 'INVALID' : remote === 'cancelled' ? 'CANCELLED' : row.status;
  const etaErrors = next === 'INVALID' ? flattenEtaErrors(result.body) : undefined;
  await prisma.etaReceipt.update({
    where: { id: row.id },
    data: {
      status: next,
      etaErrors: etaErrors ? (etaErrors as unknown as Prisma.InputJsonValue) : undefined,
      dateTimeValidated: next === 'VALID' || next === 'INVALID' ? new Date() : undefined,
    },
  });
  return { status: next };
}
