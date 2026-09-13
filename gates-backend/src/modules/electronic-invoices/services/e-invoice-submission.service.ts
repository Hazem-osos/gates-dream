import { randomUUID } from 'crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  eInvoicePayloadBuilderService,
  type EtaInvoicePayload,
  type EtaReceiptPayload,
} from './e-invoice-payload-builder.service';
import { type EtaClient, mockEtaClient } from './eta-api.client';
import { liveEtaClient } from './live-eta.client';
import { etaSigningService } from './eta-signing.service';

const ACTIVE_STATUSES = new Set(['SUBMITTED', 'VALID', 'PENDING_SIGNATURE']);

export class EInvoiceSubmissionService {
  constructor(private readonly etaClient: EtaClient = mockEtaClient) {}

  private getClient(): EtaClient {
    if (process.env.ETA_USE_LIVE_CLIENT === 'true') {
      return liveEtaClient;
    }
    // SECURITY/COMPLIANCE: without this guard, a production deploy that forgot to set
    // ETA_USE_LIVE_CLIENT silently talks to the mock client, which always returns
    // status "VALID" without ever contacting the Egyptian Tax Authority. Invoices would be
    // marked as officially submitted/accepted when nothing was actually sent.
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        500,
        'E-invoicing is misconfigured: ETA_USE_LIVE_CLIENT is not set to "true" in production, so no submission was made against the mock tax authority client.'
      );
    }
    return this.etaClient;
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
      issuerTaxId?: string;
      issuerName?: string;
      activityCode?: string;
      apiBaseUrl?: string;
    }
  ) {
    return prisma.eInvoiceSetting.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data },
    });
  }

  private async assertNoDuplicate(companyId: string, contentHash: string) {
    const existing = await prisma.eInvoiceDocument.findFirst({
      where: {
        companyId,
        contentHash,
        status: { in: ['SUBMITTED', 'VALID', 'PENDING_SIGNATURE'] },
      },
    });
    if (existing) {
      throw new AppError(409, 'Duplicate e-invoice submission (content hash already submitted)');
    }
  }

  async submitM5Invoice(companyId: string, invoiceId: string) {
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.clientId || !settings.clientSecret) {
      throw new AppError(422, 'ETA client credentials are not configured');
    }

    const payload = await eInvoicePayloadBuilderService.buildFromM5Invoice(
      companyId,
      invoiceId
    );
    const contentHash = eInvoicePayloadBuilderService.hashPayload(
      payload as unknown as Record<string, unknown>
    );

    await this.assertNoDuplicate(companyId, contentHash);

    let doc = await prisma.eInvoiceDocument.create({
      data: {
        companyId,
        invoiceId,
        documentType: payload.documentType,
        status: 'DRAFT',
        contentHash,
        rawPayload: payload as object,
        dateTimeIssued: new Date(payload.dateTimeIssued),
      },
    });

    doc = await prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: { status: 'PENDING_SIGNATURE' },
    });

    const signed = await etaSigningService.signAsync(
      payload as unknown as Record<string, unknown>,
      settings.tokenPin ?? undefined
    );
    const signedPayload: EtaInvoicePayload = {
      ...payload,
      signatures: [{ signatureType: 'I', value: signed.signature }],
    };

    const client = this.getClient();
    const token = await client.authenticate(settings.clientId, settings.clientSecret);
    const response = await client.submitDocument(
      token.access_token,
      signed.payload as Record<string, unknown>
    );

    const finalStatus = response.status === 'VALID' ? 'VALID' : 'INVALID';

    doc = await prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: {
        status: finalStatus,
        documentUuid: response.documentUuid,
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
        taxSubmitted: finalStatus === 'VALID',
        taxSubmissionId: response.submissionUuid,
        taxHash: contentHash,
      },
    });

    return doc;
  }

  async submitPosReceipt(companyId: string, posOrderId: string) {
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.clientId || !settings.clientSecret) {
      throw new AppError(422, 'ETA client credentials are not configured');
    }

    const payload = await eInvoicePayloadBuilderService.buildFromPosOrder(
      companyId,
      posOrderId
    );
    const contentHash = eInvoicePayloadBuilderService.hashPayload(
      payload as unknown as Record<string, unknown>
    );
    await this.assertNoDuplicate(companyId, contentHash);

    let doc = await prisma.eInvoiceDocument.create({
      data: {
        companyId,
        posOrderId,
        documentType: 'R',
        status: 'PENDING_SIGNATURE',
        contentHash,
        rawPayload: payload as object,
        dateTimeIssued: new Date(payload.header.dateTimeIssued),
      },
    });

    const signed = await etaSigningService.signAsync(
      payload as unknown as Record<string, unknown>,
      settings.tokenPin ?? undefined
    );
    const client = this.getClient();
    const token = await client.authenticate(settings.clientId, settings.clientSecret);
    const response = await client.submitDocument(token.access_token, signed.payload);

    return prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: {
        status: response.status === 'VALID' ? 'VALID' : 'INVALID',
        documentUuid: response.documentUuid,
        submissionUuid: response.submissionUuid,
        longId: response.longId,
        publicUrl: response.publicUrl,
        rawPayload: { ...payload, signatures: [{ signatureType: 'I', value: signed.signature }] } as object,
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
      const client = this.getClient();
      const token = await client.authenticate(settings.clientId, settings.clientSecret);
      const remote = await client.getDocumentStatus(token.access_token, documentUuid);
      if (remote.status !== doc.status) {
        return prisma.eInvoiceDocument.update({
          where: { id: doc.id },
          data: {
            status: remote.status === 'VALID' ? 'VALID' : 'INVALID',
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
      throw new AppError(422, 'ETA client credentials are not configured');
    }

    const client = this.getClient();
    const token = await client.authenticate(settings.clientId, settings.clientSecret);
    const result = await client.cancelDocument(token.access_token, documentUuid, reason);
    if (!result.accepted) throw new AppError(502, 'ETA rejected cancellation request');

    return prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }
}

export const eInvoiceSubmissionService = new EInvoiceSubmissionService();
