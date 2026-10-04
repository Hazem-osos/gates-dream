import prisma from '../../../shared/database/prisma';
import {
  canonicalizeJson,
  parseCanonicalUnsignedDocument,
  sha256HexUtf8,
  toJsonPlain,
} from '../utils/eta-canonical.util';
import { serializeEtaJsonText } from '../utils/eta-serialization';
import { unsignedEtaDocument } from '../utils/eta-local-sign';
import { logger } from '../../../shared/logger';
import {
  publicEsignDiagnostics,
  readEtaHttpMeta,
  type EsignSubmitStage,
  type EsignLocalVerify,
} from '../utils/esign-submit-diagnostics';
import {
  computeSigningAuthorization,
  ESIGN_OPERATION,
  ESIGN_SESSION_TTL_SECONDS,
  randomHex,
} from '../utils/esign-authorization';
import { verifyDetachedCades } from '../utils/cades-verify';
import { ESIGN_CODES, EsignFlowError } from '../utils/esign-flow-error';
import { AppError } from '../../../shared/middleware/error-handler';
import { esignPairingService } from './esign-pairing.service';
import { eInvoiceSubmissionService } from './e-invoice-submission.service';
import type { EtaInvoicePayload } from './e-invoice-payload-builder.service';

export class EsignSigningSessionService {
  async createAuthorizedSession(input: {
    companyId: string;
    userId: string;
    deviceId: string;
    invoiceId: string;
    documentId: string;
    documentType: string;
    unsigned: Record<string, unknown>;
    display?: { companyName?: string; internalId?: string; amount?: string; documentType?: string };
  }) {
    const device = await esignPairingService.requireActiveDevice(input.companyId, input.deviceId);
    const unsigned = toJsonPlain(unsignedEtaDocument(input.unsigned));
    const documentJson = canonicalizeJson(unsigned);
    const signingText = serializeEtaJsonText(documentJson);
    const contentHash = sha256HexUtf8(signingText);
    const nonce = randomHex(16);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ESIGN_SESSION_TTL_SECONDS * 1000);
    const session = await prisma.etaSigningSession.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        invoiceId: input.invoiceId,
        eInvoiceDocumentId: input.documentId,
        deviceId: device.deviceId,
        documentType: input.documentType,
        unsignedPayload: unsigned as object,
        canonicalPayload: documentJson,
        contentHash,
        nonce,
        requestId: nonce,
        authorization: 'pending',
        expiresAt,
        status: 'AUTHORIZED',
      },
    });

    const authorization = computeSigningAuthorization(device.credential, {
      sessionId: session.id,
      companyId: input.companyId,
      documentId: input.documentId,
      documentHash: contentHash,
      nonce,
      expiresAtUnix: Math.floor(expiresAt.getTime() / 1000),
      operation: ESIGN_OPERATION,
    });

    await prisma.etaSigningSession.update({
      where: { id: session.id },
      data: { authorization },
    });
    await prisma.esignPairedDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      signingMethod: 'LOCAL_USB_AGENT' as const,
      signingSessionId: session.id,
      companyId: input.companyId,
      requestId: nonce,
      documentId: input.documentId,
      invoiceId: input.invoiceId,
      contentHash,
      canonicalPayload: signingText,
      unsignedPayload: unsigned,
      nonce,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      authorization,
      operation: ESIGN_OPERATION,
      protocolVersion: 2,
      display: input.display ?? {},
    };
  }

  async completeSign(
    companyId: string,
    userId: string,
    input: {
      signingSessionId: string;
      requestId?: string;
      documentHash: string;
      signature: string;
      certificateThumbprint?: string;
    }
  ) {
    const now = new Date();
    const claimed = await prisma.etaSigningSession.updateMany({
      where: {
        id: input.signingSessionId,
        companyId,
        userId,
        status: 'AUTHORIZED',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { status: 'VERIFYING', consumedAt: now },
    });
    if (claimed.count !== 1) {
      const existing = await prisma.etaSigningSession.findFirst({
        where: { id: input.signingSessionId, companyId },
      });
      if (existing?.status === 'SIGNED' && existing.cadesBase64) {
        throw new EsignFlowError(
          409,
          ESIGN_CODES.SIGNING_REQUEST_REPLAYED,
          'الجلسة اتوقّعت. استخدم إعادة الإرسال إذا فشل الإرسال لمصلحة الضرائب'
        );
      }
      if (!existing || existing.expiresAt.getTime() <= Date.now()) {
        throw new EsignFlowError(409, ESIGN_CODES.SIGNING_SESSION_EXPIRED, 'انتهت صلاحية جلسة التوقيع');
      }
      throw new EsignFlowError(409, ESIGN_CODES.SIGNING_REQUEST_REPLAYED, 'جلسة التوقيع استُخدمت من قبل');
    }

    const session = await prisma.etaSigningSession.findFirst({
      where: { id: input.signingSessionId, companyId },
    });
    if (!session) {
      throw new EsignFlowError(404, ESIGN_CODES.SIGNING_AUTHORIZATION_INVALID, 'جلسة التوقيع غير موجودة');
    }
    if (input.requestId && input.requestId !== session.requestId && input.requestId !== session.nonce) {
      await prisma.etaSigningSession.update({
        where: { id: session.id },
        data: { status: 'FAILED' },
      });
      throw new EsignFlowError(409, ESIGN_CODES.SIGNING_AUTHORIZATION_INVALID, 'معرّف الطلب لا يطابق الجلسة');
    }
    const expectedHash = session.contentHash.trim().toLowerCase();
    if (String(input.documentHash).trim().toLowerCase() !== expectedHash) {
      await prisma.etaSigningSession.update({
        where: { id: session.id },
        data: { status: 'FAILED' },
      });
      throw new EsignFlowError(409, ESIGN_CODES.DOCUMENT_HASH_MISMATCH, 'هاش المستند لا يطابق الجلسة');
    }

    const signingText = serializeEtaJsonText(session.canonicalPayload);
    const verified = verifyDetachedCades({
      canonicalPayload: signingText,
      signatureBase64: input.signature,
      expectedHash: session.contentHash,
    });
    if (!verified.ok) {
      await prisma.etaSigningSession.update({
        where: { id: session.id },
        data: { status: 'FAILED' },
      });
      throw new EsignFlowError(
        422,
        verified.reason === 'DOCUMENT_HASH_MISMATCH'
          ? ESIGN_CODES.DOCUMENT_HASH_MISMATCH
          : ESIGN_CODES.CADES_VERIFICATION_FAILED,
        'فشل التحقق من توقيع CAdES على نفس المستند المجهّز'
      );
    }

    await prisma.etaSigningSession.update({
      where: { id: session.id },
      data: {
        status: 'SIGNED',
        cadesBase64: input.signature.trim(),
        certificateThumbprint: input.certificateThumbprint || verified.certificateThumbprint,
      },
    });

    return this.submitSignedSession(companyId, session.id, 'passed');
  }

  async retrySubmit(companyId: string, userId: string, signingSessionId: string) {
    const session = await prisma.etaSigningSession.findFirst({
      where: { id: signingSessionId, companyId, userId },
    });
    if (!session?.cadesBase64 || (session.status !== 'SIGNED' && session.status !== 'FAILED')) {
      throw new EsignFlowError(409, ESIGN_CODES.SIGNING_AUTHORIZATION_INVALID, 'لا يوجد توقيع محفوظ لإعادة الإرسال');
    }
    return this.submitSignedSession(companyId, session.id, 'skipped_already_signed');
  }

  private async submitSignedSession(
    companyId: string,
    signingSessionId: string,
    localVerify: EsignLocalVerify
  ) {
    const session = await prisma.etaSigningSession.findFirst({
      where: { id: signingSessionId, companyId },
    });
    if (!session?.cadesBase64) {
      throw new EsignFlowError(409, ESIGN_CODES.SIGNING_AUTHORIZATION_INVALID, 'التوقيع غير محفوظ');
    }

    const submitTrace: { stage: EsignSubmitStage; etaHttpStatus?: number; etaBodyPreview?: string } = {
      stage: 'canonical_rebuilt',
    };
    const baseDiagnostics = {
      signingSessionId: session.id,
      documentId: session.eInvoiceDocumentId,
      contentHash: session.contentHash,
      localVerify,
    };

    let unsigned: Record<string, unknown>;
    try {
      unsigned = parseCanonicalUnsignedDocument(session.canonicalPayload, session.contentHash);
    } catch {
      const diagnostics = publicEsignDiagnostics({
        ...baseDiagnostics,
        stage: 'canonical_rebuilt',
        originalCode: ESIGN_CODES.DOCUMENT_HASH_MISMATCH,
        originalStatusCode: 409,
      });
      logger.warn({ msg: 'esign_submit_failed', ...diagnostics });
      throw new EsignFlowError(
        409,
        ESIGN_CODES.DOCUMENT_HASH_MISMATCH,
        'المستند المحفوظ لا يطابق هاش الجلسة',
        diagnostics
      );
    }

    try {
      const submitted = await eInvoiceSubmissionService.submitPreparedSignedDocument(
        companyId,
        session.eInvoiceDocumentId,
        {
          contentHash: session.contentHash,
          signature: session.cadesBase64,
          unsignedDocument: unsigned,
          submitTrace,
          actorUserId: session.userId,
        }
      );
      await prisma.etaSigningSession.update({
        where: { id: session.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          etaStatus: submitted.status,
        },
      });
      return {
        localSigning: 'LOCAL_SIGNING_SUCCESS' as const,
        etaSubmission: submitted.status === 'INVALID' ? 'ETA_SUBMISSION_FAILED' : 'ETA_SUBMISSION_SUCCESS',
        document: submitted,
        signingSessionId: session.id,
      };
    } catch (error) {
      await prisma.etaSigningSession.update({
        where: { id: session.id },
        data: { status: 'SIGNED', etaStatus: 'SUBMIT_FAILED' },
      });
      const originalStatusCode = error instanceof AppError ? error.statusCode : undefined;
      const originalCode =
        error instanceof EsignFlowError
          ? error.code
          : error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : undefined;
      const etaMeta = { ...readEtaHttpMeta(error), ...readEtaHttpMeta(submitTrace) };
      const diagnostics = publicEsignDiagnostics({
        ...baseDiagnostics,
        stage: submitTrace.stage,
        originalCode,
        originalStatusCode,
        etaHttpStatus: etaMeta.etaHttpStatus,
        etaBodyPreview: submitTrace.etaBodyPreview || etaMeta.etaBodyPreview,
      });
      logger.warn({ msg: 'esign_submit_failed', ...diagnostics });
      if (error instanceof EsignFlowError) {
        error.diagnostics = diagnostics;
        throw error;
      }
      const message = error instanceof Error ? error.message : 'تعذر إرسال المستند الموقّع لمصلحة الضرائب';
      throw new EsignFlowError(502, ESIGN_CODES.ETA_SUBMISSION_FAILED, message, diagnostics);
    }
  }
}

export const esignSigningSessionService = new EsignSigningSessionService();
export type { EtaInvoicePayload };
