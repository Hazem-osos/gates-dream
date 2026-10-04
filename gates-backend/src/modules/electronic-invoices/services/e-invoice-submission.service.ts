import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  eInvoicePayloadBuilderService,
  type EtaInvoicePayload,
} from './e-invoice-payload-builder.service';
import { type EtaClient, mockEtaClient } from './eta-api.client';
import { liveEtaClient } from './live-eta.client';
import { etaSigningService, withIssuerSignature } from './eta-signing.service';
import { etaPfxConfigured } from './eta-pfx-signer';
import { resolveEtaEndpoints, type EtaEndpoints } from '../utils/eta-endpoints';
import {
  amendmentInternalId,
  invoiceDiffersFromSubmittedPayload,
  resolveEtaAmendmentMethod,
} from '../utils/eta-amendment';
import {
  assertCadesBesBase64,
  hashUnsignedEtaDocument,
  LOCAL_SIGN_REQUIRED_AR,
  resolveWebSubmitSigning,
  unsignedEtaDocument,
} from '../utils/eta-local-sign';
import { toJsonPlain } from '../utils/eta-canonical.util';
import { assertEtaInvoiceDocument, assertEtaReceiptDocument } from '../utils/eta-document-normalize';
import {
  readEtaHttpMeta,
  sanitizeEtaPreview,
  type EsignSubmitStage,
} from '../utils/esign-submit-diagnostics';

const BLOCKING_STATUSES = new Set(['SUBMITTED', 'VALID']);

export class EInvoiceSubmissionService {
  constructor(private readonly etaClient: EtaClient = mockEtaClient) {}

  private getClient(): EtaClient {
    if (process.env.NODE_ENV === 'production' || process.env.ETA_USE_LIVE_CLIENT === 'true') {
      return liveEtaClient;
    }
    return this.etaClient;
  }

  private endpointsFor(settings: {
    environment?: string | null;
    apiBaseUrl?: string | null;
    issuerAddress?: unknown;
  }): EtaEndpoints {
    const address =
      settings.issuerAddress && typeof settings.issuerAddress === 'object'
        ? (settings.issuerAddress as Record<string, unknown>)
        : {};
    return resolveEtaEndpoints({
      environment: settings.environment,
      tokenUrl: settings.apiBaseUrl,
      invoiceUrl: typeof address.invoiceAPI === 'string' ? address.invoiceAPI : null,
    });
  }

  async getSettings(companyId: string) {
    return prisma.eInvoiceSetting.findUnique({ where: { companyId } });
  }

  async upsertSettings(
    companyId: string,
    data: {
      clientId?: string;
      clientSecret?: string;
      tokenPin?: string;
      environment?: string;
      issuerTaxId?: string | null;
      issuerName?: string | null;
      activityCode?: string | null;
      apiBaseUrl?: string;
      enabledSalesProfileIds?: string[] | null;
      issuerAddress?: Record<string, unknown>;
    }
  ) {
    const update = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    return prisma.eInvoiceSetting.upsert({
      where: { companyId },
      update,
      create: { companyId, ...update },
    });
  }

  private async assertNoBlockingDuplicate(companyId: string, contentHash: string) {
    const existing = await prisma.eInvoiceDocument.findFirst({
      where: {
        companyId,
        contentHash,
        status: { in: [...BLOCKING_STATUSES] },
      },
    });
    if (existing) {
      throw new AppError(409, 'Duplicate e-invoice submission (content hash already submitted)');
    }
  }

  async submitM5Invoice(companyId: string, invoiceId: string, issuerSignature?: string, actorUserId?: string) {
    const payload = await eInvoicePayloadBuilderService.buildFromM5Invoice(companyId, invoiceId);
    return this.persistAndSubmitInvoice(companyId, invoiceId, payload, { issuerSignature, actorUserId });
  }

  async submitM5Amendment(companyId: string, invoiceId: string, issuerSignature?: string, actorUserId?: string) {
    const built = await this.buildAmendmentPayload(companyId, invoiceId);
    if (built.cancelOriginal) {
      await this.cancelDocument(companyId, built.originalDocumentUuid, 'تعديل بعد الإرسال');
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { taxSubmitted: false },
      });
    }
    return this.persistAndSubmitInvoice(companyId, invoiceId, built.payload, {
      originalDocumentUuid: built.originalDocumentUuid,
      issuerSignature,
      actorUserId,
    });
  }

  async prepareM5InvoiceForLocalSign(companyId: string, invoiceId: string, actorUserId?: string) {
    const payload = await eInvoicePayloadBuilderService.buildFromM5Invoice(companyId, invoiceId);
    return this.persistPreparedUnsigned(companyId, invoiceId, payload, { actorUserId });
  }

  async prepareM5AmendmentForLocalSign(companyId: string, invoiceId: string, actorUserId?: string) {
    const built = await this.buildAmendmentPayload(companyId, invoiceId);
    return this.persistPreparedUnsigned(companyId, invoiceId, built.payload, {
      originalDocumentUuid: built.originalDocumentUuid,
      cancelOriginal: built.cancelOriginal,
      actorUserId,
    });
  }

  async submitPreparedSignedDocument(
    companyId: string,
    documentId: string,
    input: {
      contentHash: string;
      signature: string;
      unsignedDocument?: Record<string, unknown>;
      submitTrace?: { stage: EsignSubmitStage; etaHttpStatus?: number; etaBodyPreview?: string };
      actorUserId?: string;
    }
  ) {
    const doc = await prisma.eInvoiceDocument.findFirst({
      where: { id: documentId, companyId },
    });
    if (!doc) throw new AppError(404, 'مستند التوقيع غير موجود');
    if (doc.status !== 'PENDING_SIGNATURE' && doc.status !== 'DRAFT') {
      throw new AppError(409, 'المستند اتبعت قبل كده أو حالته مش جاهزة للتوقيع');
    }
    if (!doc.invoiceId) throw new AppError(422, 'المستند مش مربوط بفاتورة');

    const expected = String(input.contentHash ?? '').trim().toLowerCase();
    const stored = unsignedEtaDocument(
      input.unsignedDocument
        ? input.unsignedDocument
        : doc.rawPayload && typeof doc.rawPayload === 'object'
          ? { ...(doc.rawPayload as Record<string, unknown>) }
          : {}
    );
    const storedHash = hashUnsignedEtaDocument(stored);
    if (storedHash !== expected) {
      throw new AppError(409, 'المستند اتغيّر بعد التجهيز. جهّز الفاتورة من جديد ثم وقّع نفس النسخة');
    }
    if (!input.unsignedDocument && storedHash !== doc.contentHash) {
      throw new AppError(409, 'المستند اتغيّر بعد التجهيز. جهّز الفاتورة من جديد ثم وقّع نفس النسخة');
    }
    if (input.unsignedDocument && doc.contentHash && doc.contentHash.toLowerCase() !== expected) {
      throw new AppError(409, 'المستند اتغيّر بعد التجهيز. جهّز الفاتورة من جديد ثم وقّع نفس النسخة');
    }

    const details =
      doc.errorDetails && typeof doc.errorDetails === 'object'
        ? (doc.errorDetails as { localSign?: { cancelOriginal?: boolean } })
        : {};
    if (details.localSign?.cancelOriginal && doc.originalDocumentUuid) {
      await this.cancelDocument(companyId, doc.originalDocumentUuid, 'تعديل بعد الإرسال');
      await prisma.invoice.update({
        where: { id: doc.invoiceId },
        data: { taxSubmitted: false },
      });
    }

    const signature = assertCadesBesBase64(input.signature);
    return this.persistAndSubmitInvoice(
      companyId,
      doc.invoiceId,
      stored as unknown as EtaInvoicePayload,
      {
        originalDocumentUuid: doc.originalDocumentUuid ?? undefined,
        issuerSignature: signature,
        reuseDocumentId: doc.id,
        submitTrace: input.submitTrace,
        actorUserId: input.actorUserId,
      }
    );
  }

  private async actorStamp(userId?: string) {
    const id = userId?.trim();
    if (!id || id === 'system') return {};
    const user = await prisma.user.findFirst({
      where: { id },
      select: { username: true, firstName: true, lastName: true },
    });
    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || null;
    return { submittedByUserId: id, submittedByName: name };
  }

  private async persistPreparedUnsigned(
    companyId: string,
    invoiceId: string,
    payload: EtaInvoicePayload,
    extra?: { originalDocumentUuid?: string; cancelOriginal?: boolean; actorUserId?: string }
  ) {
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.clientId || !settings.clientSecret) {
      throw new AppError(
        422,
        'بيانات دخول منظومة الضرائب مش متسجلة. سجّلها من إعدادات الفواتير الإلكترونية'
      );
    }

    assertEtaInvoiceDocument(payload);
    const unsigned = toJsonPlain(unsignedEtaDocument(payload as unknown as Record<string, unknown>));
    const contentHash = hashUnsignedEtaDocument(unsigned);
    await this.assertNoBlockingDuplicate(companyId, contentHash);

    const reusable = await prisma.eInvoiceDocument.findFirst({
      where: { companyId, contentHash, status: 'PENDING_SIGNATURE' },
    });
    const actor = await this.actorStamp(extra?.actorUserId);
    const doc =
      reusable ??
      (await prisma.eInvoiceDocument.create({
        data: {
          companyId,
          invoiceId,
          documentType: payload.documentType,
          status: 'PENDING_SIGNATURE',
          contentHash,
          rawPayload: unsigned as object,
          dateTimeIssued: new Date(payload.dateTimeIssued),
          originalDocumentUuid: extra?.originalDocumentUuid,
          errorDetails: extra?.cancelOriginal ? { localSign: { cancelOriginal: true } } : undefined,
          ...actor,
        },
      }));

    return {
      documentId: doc.id,
      invoiceId,
      contentHash,
      unsignedPayload: unsigned,
      documentType: payload.documentType,
    };
  }

  private async buildAmendmentPayload(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId, isPosted: true, isCancelled: false },
      include: {
        lines: true,
        eInvoiceDocuments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');

    const original = invoice.eInvoiceDocuments.find(
      (doc) =>
        Boolean(doc.documentUuid) &&
        (doc.status === 'VALID' || doc.status === 'SUBMITTED')
    );
    if (!original?.documentUuid) {
      throw new AppError(422, 'الفاتورة لم تُرسل لمصلحة الضرائب بعد');
    }

    const diverged = invoiceDiffersFromSubmittedPayload({
      netAmount: Number(invoice.netAmount),
      taxAmount: Number(invoice.taxAmount),
      date: invoice.date,
      lines: invoice.lines,
      payload: original.rawPayload,
    });
    if (!diverged) {
      throw new AppError(422, 'لا يوجد تعديل بعد الإرسال على هذه الفاتورة');
    }

    const payloadBody =
      original.rawPayload && typeof original.rawPayload === 'object'
        ? (original.rawPayload as { totalAmount?: unknown; netAmount?: unknown; invoiceLines?: unknown[] })
        : {};
    const submittedNet = Number(payloadBody.totalAmount ?? payloadBody.netAmount ?? invoice.netAmount);
    const issuedAt = original.dateTimeIssued ?? original.submittedAt ?? invoice.date;
    const amendment = resolveEtaAmendmentMethod({
      issuedAt,
      submittedNet,
      currentNet: Number(invoice.netAmount),
      structuralChange:
        invoice.lines.length !== (payloadBody.invoiceLines?.length ?? invoice.lines.length),
    });
    if (amendment.method === 'unsupported') {
      throw new AppError(
        422,
        'تعديل البنود بعد 72 ساعة بدون تغيير المبلغ لا يُرسل تلقائيًا. أصدر إشعار خصم/إضافة يدويًا أو فاتورة جديدة.'
      );
    }

    if (amendment.method === 'cancel-resubmit') {
      return {
        originalDocumentUuid: original.documentUuid,
        cancelOriginal: true,
        payload: await eInvoicePayloadBuilderService.buildFromM5Invoice(companyId, invoiceId, {
          internalID: amendmentInternalId(
            invoice.invoiceNumber || invoice.id.slice(0, 12),
            'cancel-resubmit'
          ),
        }),
      };
    }

    return {
      originalDocumentUuid: original.documentUuid,
      cancelOriginal: false,
      payload: await eInvoicePayloadBuilderService.buildFromM5Invoice(companyId, invoiceId, {
        documentType: amendment.method === 'credit' ? 'C' : 'D',
        references: [original.documentUuid],
        internalID: amendmentInternalId(
          invoice.invoiceNumber || invoice.id.slice(0, 12),
          amendment.method
        ),
      }),
    };
  }

  private async persistAndSubmitInvoice(
    companyId: string,
    invoiceId: string,
    payload: EtaInvoicePayload,
    extra?: {
      originalDocumentUuid?: string;
      issuerSignature?: string;
      reuseDocumentId?: string;
      submitTrace?: { stage: EsignSubmitStage; etaHttpStatus?: number; etaBodyPreview?: string };
      actorUserId?: string;
    }
  ) {
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.clientId || !settings.clientSecret) {
      throw new AppError(
        422,
        'بيانات دخول منظومة الضرائب مش متسجلة. سجّلها من إعدادات الفواتير الإلكترونية'
      );
    }

    assertEtaInvoiceDocument(payload);
    const unsigned = unsignedEtaDocument(payload as unknown as Record<string, unknown>);
    const contentHash = hashUnsignedEtaDocument(unsigned);
    if (!extra?.reuseDocumentId) {
      await this.assertNoBlockingDuplicate(companyId, contentHash);
    }

    const mode = resolveWebSubmitSigning({
      issuerSignature: extra?.issuerSignature,
      pfxConfigured: etaPfxConfigured(),
    });
    if (mode === 'local-sign-required') {
      throw new AppError(422, LOCAL_SIGN_REQUIRED_AR);
    }

    let signedPayload: Record<string, unknown>;
    if (mode === 'client-cades') {
      signedPayload = withIssuerSignature(unsigned, assertCadesBesBase64(extra?.issuerSignature ?? ''));
    } else {
      const signed = await etaSigningService.signAsync(unsigned, settings.tokenPin ?? undefined);
      signedPayload = withIssuerSignature(signed.payload, signed.signature);
    }

    const endpoints = this.endpointsFor(settings);
    const actor = await this.actorStamp(extra?.actorUserId);
    const createData = {
      companyId,
      invoiceId,
      documentType: payload.documentType,
      status: 'PENDING_SIGNATURE',
      contentHash,
      rawPayload: signedPayload as object,
      dateTimeIssued: new Date(payload.dateTimeIssued),
      originalDocumentUuid: extra?.originalDocumentUuid,
      ...actor,
    };

    let doc = extra?.reuseDocumentId
      ? await prisma.eInvoiceDocument.update({
          where: { id: extra.reuseDocumentId },
          data: createData,
        })
      : await prisma.eInvoiceDocument.create({ data: createData });

    const client = this.getClient();
    const trace = extra?.submitTrace;
    if (trace) trace.stage = 'eta_authenticate';
    let token;
    try {
      token = await client.authenticate(settings.clientId, settings.clientSecret, endpoints);
    } catch (error) {
      Object.assign(trace ?? {}, readEtaHttpMeta(error));
      throw error;
    }
    if (trace) trace.stage = 'eta_submit';
    let response;
    try {
      response = await client.submitDocument(token.access_token, signedPayload, endpoints);
    } catch (error) {
      Object.assign(trace ?? {}, readEtaHttpMeta(error));
      throw error;
    }
    if (trace) trace.stage = 'eta_interpreted';

    const finalStatus = response.status;

    doc = await prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: {
        status: finalStatus,
        documentUuid: response.documentUuid || null,
        submissionUuid: response.submissionUuid,
        longId: response.longId,
        publicUrl: response.publicUrl,
        submissionResponse: response as object,
        validationErrors: response.validationErrors as object | undefined,
        dateTimeReceived: new Date(response.dateTimeReceived),
        submittedAt: new Date(),
        rawPayload: signedPayload as object,
      },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        taxSubmitted: finalStatus === 'VALID' || finalStatus === 'SUBMITTED',
        taxSubmissionId: response.submissionUuid,
        taxHash: contentHash,
      },
    });

    if (finalStatus === 'INVALID') {
      const message =
        response.validationErrors?.map((row) => row.message).filter(Boolean).join(' — ') ||
        'مصلحة الضرائب رفضت الفاتورة';
      if (trace) trace.etaBodyPreview = sanitizeEtaPreview(message);
      throw new AppError(422, message);
    }

    return doc;
  }

  async submitPosReceipt(companyId: string, posOrderId: string, issuerSignature?: string) {
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.clientId || !settings.clientSecret) {
      throw new AppError(
        422,
        'بيانات دخول منظومة الضرائب مش متسجلة. سجّلها من إعدادات الفواتير الإلكترونية'
      );
    }

    const payload = await eInvoicePayloadBuilderService.buildFromPosOrder(companyId, posOrderId);
    assertEtaReceiptDocument(payload);
    const unsigned = unsignedEtaDocument(payload as unknown as Record<string, unknown>);
    const contentHash = hashUnsignedEtaDocument(unsigned);
    await this.assertNoBlockingDuplicate(companyId, contentHash);

    const mode = resolveWebSubmitSigning({
      issuerSignature,
      pfxConfigured: etaPfxConfigured(),
    });
    if (mode === 'local-sign-required') {
      throw new AppError(422, LOCAL_SIGN_REQUIRED_AR);
    }

    let signedPayload: Record<string, unknown>;
    if (mode === 'client-cades') {
      signedPayload = withIssuerSignature(unsigned, assertCadesBesBase64(issuerSignature ?? ''));
    } else {
      const signed = await etaSigningService.signAsync(unsigned, settings.tokenPin ?? undefined);
      signedPayload = withIssuerSignature(signed.payload, signed.signature);
    }
    const endpoints = this.endpointsFor(settings);

    const doc = await prisma.eInvoiceDocument.create({
      data: {
        companyId,
        posOrderId,
        documentType: 'R',
        status: 'PENDING_SIGNATURE',
        contentHash,
        rawPayload: signedPayload as object,
        dateTimeIssued: new Date(payload.header.dateTimeIssued),
      },
    });

    const client = this.getClient();
    const token = await client.authenticate(settings.clientId, settings.clientSecret, endpoints);
    const response = await client.submitDocument(token.access_token, signedPayload, endpoints);

    return prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: {
        status: response.status,
        documentUuid: response.documentUuid || null,
        submissionUuid: response.submissionUuid,
        longId: response.longId,
        publicUrl: response.publicUrl,
        rawPayload: signedPayload as object,
        submissionResponse: response as object,
        dateTimeReceived: new Date(response.dateTimeReceived),
        submittedAt: new Date(),
      },
    });
  }

  async getStatus(companyId: string, documentUuid: string) {
    const doc = await prisma.eInvoiceDocument.findFirst({
      where: { companyId, documentUuid },
    });
    if (!doc) throw new AppError(404, 'E-invoice document not found');

    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (settings?.clientId && settings.clientSecret) {
      const endpoints = this.endpointsFor(settings);
      const client = this.getClient();
      const token = await client.authenticate(settings.clientId, settings.clientSecret, endpoints);
      const remote = await client.getDocumentStatus(token.access_token, documentUuid, endpoints);
      if (remote.status !== doc.status) {
        return prisma.eInvoiceDocument.update({
          where: { id: doc.id },
          data: {
            status: remote.status,
            validationErrors: remote.validationErrors as object | undefined,
          },
        });
      }
    }
    return doc;
  }

  async cancelDocument(companyId: string, documentUuid: string, reason: string) {
    const doc = await prisma.eInvoiceDocument.findFirst({
      where: { companyId, documentUuid },
    });
    if (!doc) throw new AppError(404, 'E-invoice document not found');
    if (doc.status === 'CANCELLED') throw new AppError(400, 'Document already cancelled');
    if (doc.status !== 'VALID' && doc.status !== 'SUBMITTED') {
      throw new AppError(422, 'Only valid/submitted documents can be cancelled');
    }

    const issued = doc.dateTimeIssued ?? doc.createdAt;
    const hoursSince = (Date.now() - issued.getTime()) / 3_600_000;
    if (hoursSince > 72) {
      throw new AppError(422, 'ETA cancellation window (72h) has expired');
    }

    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.clientId || !settings.clientSecret) {
      throw new AppError(
        422,
        'بيانات دخول منظومة الضرائب مش متسجلة. سجّلها من إعدادات الفواتير الإلكترونية'
      );
    }

    const endpoints = this.endpointsFor(settings);
    const client = this.getClient();
    const token = await client.authenticate(settings.clientId, settings.clientSecret, endpoints);
    const result = await client.cancelDocument(token.access_token, documentUuid, reason, endpoints);
    if (!result.accepted) throw new AppError(502, 'ETA rejected cancellation request');

    return prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }
}

export const eInvoiceSubmissionService = new EInvoiceSubmissionService();
