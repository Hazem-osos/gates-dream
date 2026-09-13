import { randomUUID } from 'node:crypto';
import type { DocumentCategory, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { licenseSubscriptionService } from '../../platform/services/license-subscription.service';
import { resolveStorageProvider } from '../storage/resolve-storage-provider';
import type { StorageProvider } from '../storage/storage-provider';
import {
  assertTenantKey,
  buildTenantObjectKey,
  sanitizeFileName,
} from '../storage/storage-provider';
import { consumeLocalUploadTicket } from '../storage/local-upload-tickets';
import {
  assertAllowedFile,
  deriveEntityPointer,
  DOCUMENT_LINK_FIELDS,
  ENTITY_TYPE_TO_LINK,
  linksFromInput,
  maxBytesForCategory,
  PRESIGN_DOWNLOAD_SECONDS,
  PRESIGN_UPLOAD_SECONDS,
  toPublicAttachment,
  type DocumentEntityLinks,
} from '../types/document-attachment.types';

export type PresignUploadInput = DocumentEntityLinks & {
  companyId: string;
  userId: string;
  branchId?: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  fileCategory?: DocumentCategory;
  description?: string;
  entityType?: string;
  entityId?: string;
};

export class DocumentAttachmentService {
  constructor(private readonly storage: StorageProvider = resolveStorageProvider()) {}

  private async assertStorageQuota(companyId: string, additionalBytes: number) {
    const sub = await licenseSubscriptionService.getForCompany(companyId);
    if (!sub) return;

    const used = await prisma.documentAttachment.aggregate({
      where: { companyId, deletedAt: null, isArchived: false },
      _sum: { fileSize: true },
    });
    const usedBytes = Number(used._sum.fileSize ?? 0);
    const limitBytes = sub.maxStorageMb * 1024 * 1024;
    if (usedBytes + additionalBytes > limitBytes) {
      throw new AppError(422, 'تم تجاوز حصة تخزين المستندات لهذا المستأجر');
    }
  }

  private async assertLinkTargets(companyId: string, links: DocumentEntityLinks) {
    if (links.subcontractId) {
      const row = await prisma.subcontract.findFirst({ where: { id: links.subcontractId, companyId } });
      if (!row) throw new AppError(404, 'عقد مقاول الباطن غير موجود');
    }
    if (links.subcontractInvoiceId) {
      const row = await prisma.subcontractInvoice.findFirst({
        where: { id: links.subcontractInvoiceId, companyId },
      });
      if (!row) throw new AppError(404, 'مستخلص مقاول الباطن غير موجود');
    }
    if (links.clientContractId) {
      const row = await prisma.clientContract.findFirst({
        where: { id: links.clientContractId, companyId },
      });
      if (!row) throw new AppError(404, 'عقد المالك غير موجود');
    }
    if (links.clientInvoiceId) {
      const row = await prisma.clientInvoice.findFirst({
        where: { id: links.clientInvoiceId, companyId },
      });
      if (!row) throw new AppError(404, 'مستخلص المالك غير موجود');
    }
    if (links.letterOfGuaranteeId) {
      const row = await prisma.projectLetterOfGuarantee.findFirst({
        where: { id: links.letterOfGuaranteeId, companyId },
      });
      if (!row) throw new AppError(404, 'خطاب الضمان غير موجود');
    }
    if (links.executiveMeasurementSheetId) {
      const row = await prisma.executiveMeasurementSheet.findFirst({
        where: { id: links.executiveMeasurementSheetId, companyId },
      });
      if (!row) throw new AppError(404, 'حصر تنفيذي غير موجود');
    }
    if (links.unitContractId) {
      const row = await prisma.unitContract.findFirst({
        where: { id: links.unitContractId, companyId },
      });
      if (!row) throw new AppError(404, 'عقد الوحدة غير موجود');
    }
    if (links.sitePenaltyId) {
      const row = await prisma.sitePenaltyAndSnag.findFirst({
        where: { id: links.sitePenaltyId, subcontract: { companyId } },
      });
      if (!row) throw new AppError(404, 'الغرامة الموقع غير موجودة');
    }
    if (links.materialReconciliationId) {
      const row = await prisma.materialReconciliationLog.findFirst({
        where: { id: links.materialReconciliationId, subcontract: { companyId } },
      });
      if (!row) throw new AppError(404, 'تسوية الخامات غير موجودة');
    }
    if (links.propertyUnitId) {
      const row = await prisma.propertyUnit.findFirst({
        where: { id: links.propertyUnitId, phase: { project: { companyId } } },
      });
      if (!row) throw new AppError(404, 'الوحدة العقارية غير موجودة');
    }
  }

  async requestPresignedUpload(input: PresignUploadInput) {
    const category = input.fileCategory ?? 'GENERAL';
    assertAllowedFile(input.originalFileName, input.mimeType, category);
    const maxBytes = maxBytesForCategory(category);
    if (input.fileSize <= 0 || input.fileSize > maxBytes) {
      throw new AppError(413, `حجم الملف يتجاوز الحد المسموح (${Math.round(maxBytes / (1024 * 1024))} ميجابايت)`);
    }

    const links = linksFromInput(input);
    if (input.entityType && input.entityId) {
      const field = ENTITY_TYPE_TO_LINK[input.entityType];
      if (field) links[field] = input.entityId;
    }
    await this.assertLinkTargets(input.companyId, links);
    await this.assertStorageQuota(input.companyId, input.fileSize);

    const id = randomUUID();
    const storedFileName = sanitizeFileName(input.originalFileName);
    const storagePathKey = buildTenantObjectKey({
      companyId: input.companyId,
      attachmentId: id,
      storedFileName,
    });
    const pointer = deriveEntityPointer(links, input);

    const row = await prisma.documentAttachment.create({
      data: {
        id,
        companyId: input.companyId,
        branchId: input.branchId,
        originalFileName: input.originalFileName,
        storedFileName,
        fileName: input.originalFileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        storageProvider: this.storage.kind,
        storagePathKey,
        storagePath: storagePathKey,
        fileCategory: category,
        description: input.description,
        entityType: pointer.entityType,
        entityId: pointer.entityId,
        uploadedByUserId: input.userId,
        uploadedById: input.userId,
        isArchived: false,
        ...links,
      },
    });

    const presign = await this.storage.createPresignedUpload(
      storagePathKey,
      input.mimeType,
      PRESIGN_UPLOAD_SECONDS
    );

    return {
      attachment: toPublicAttachment(row),
      upload: {
        url: presign.url,
        method: presign.method,
        headers: presign.headers,
        expiresAt: presign.expiresAt,
        uploadToken: presign.uploadToken,
        storageProvider: this.storage.kind,
      },
    };
  }

  async completeUpload(companyId: string, attachmentId: string) {
    const row = await this.requireOwned(companyId, attachmentId);
    assertTenantKey(companyId, row.storagePathKey || row.storagePath);

    const head = await this.storage.headObject?.(row.storagePathKey || row.storagePath);
    if (!head || head.contentLength <= 0) {
      throw new AppError(409, 'لم يُستلم الملف بعد. أكمل الرفع ثم أكّد.');
    }

    const updated = await prisma.documentAttachment.update({
      where: { id: row.id },
      data: {
        fileSize: head.contentLength,
        mimeType: head.contentType || row.mimeType,
      },
    });
    return toPublicAttachment(updated);
  }

  async uploadDirect(input: PresignUploadInput & { buffer: Buffer }) {
    const category = input.fileCategory ?? 'GENERAL';
    assertAllowedFile(input.originalFileName, input.mimeType, category);
    const maxBytes = maxBytesForCategory(category);
    if (input.buffer.length <= 0 || input.buffer.length > maxBytes) {
      throw new AppError(413, `حجم الملف يتجاوز الحد المسموح (${Math.round(maxBytes / (1024 * 1024))} ميجابايت)`);
    }

    const links = linksFromInput(input);
    if (input.entityType && input.entityId) {
      const field = ENTITY_TYPE_TO_LINK[input.entityType];
      if (field) links[field] = input.entityId;
    }
    await this.assertLinkTargets(input.companyId, links);
    await this.assertStorageQuota(input.companyId, input.buffer.length);

    const id = randomUUID();
    const storedFileName = sanitizeFileName(input.originalFileName);
    const storagePathKey = buildTenantObjectKey({
      companyId: input.companyId,
      attachmentId: id,
      storedFileName,
    });
    const pointer = deriveEntityPointer(links, input);

    await this.storage.put({
      companyId: input.companyId,
      attachmentId: id,
      fileName: storedFileName,
      mimeType: input.mimeType,
      buffer: input.buffer,
      objectKey: storagePathKey,
    });

    const row = await prisma.documentAttachment.create({
      data: {
        id,
        companyId: input.companyId,
        branchId: input.branchId,
        originalFileName: input.originalFileName,
        storedFileName,
        fileName: input.originalFileName,
        fileSize: input.buffer.length,
        mimeType: input.mimeType,
        storageProvider: this.storage.kind,
        storagePathKey,
        storagePath: storagePathKey,
        fileCategory: category,
        description: input.description,
        entityType: pointer.entityType,
        entityId: pointer.entityId,
        uploadedByUserId: input.userId,
        uploadedById: input.userId,
        ...links,
      },
    });
    return toPublicAttachment(row);
  }

  async receiveLocalBytes(input: {
    companyId: string;
    attachmentId: string;
    token: string;
    buffer: Buffer;
    mimeType?: string;
  }) {
    const ticket = consumeLocalUploadTicket(input.token);
    if (!ticket || ticket.attachmentId !== input.attachmentId || ticket.companyId !== input.companyId) {
      throw new AppError(403, 'رمز الرفع غير صالح أو منتهٍ');
    }
    if (input.buffer.length > ticket.maxBytes) {
      throw new AppError(413, 'حجم الملف يتجاوز الحد المسموح');
    }
    const row = await this.requireOwned(input.companyId, input.attachmentId);
    assertTenantKey(input.companyId, row.storagePathKey || row.storagePath);
    await this.storage.put({
      companyId: input.companyId,
      attachmentId: row.id,
      fileName: row.storedFileName,
      mimeType: input.mimeType || ticket.mimeType,
      buffer: input.buffer,
      objectKey: row.storagePathKey || row.storagePath,
    });
    const updated = await prisma.documentAttachment.update({
      where: { id: row.id },
      data: { fileSize: input.buffer.length },
    });
    return toPublicAttachment(updated);
  }

  async list(companyId: string, filters: DocumentEntityLinks & { entityType?: string; entityId?: string }) {
    const where: Prisma.DocumentAttachmentWhereInput = {
      companyId,
      deletedAt: null,
      isArchived: false,
    };
    const links = linksFromInput(filters);
    for (const field of DOCUMENT_LINK_FIELDS) {
      if (links[field]) where[field] = links[field];
    }
    if (filters.entityType && filters.entityId) {
      where.entityType = filters.entityType;
      where.entityId = filters.entityId;
    }
    const rows = await prisma.documentAttachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPublicAttachment);
  }

  async getDownloadGrant(companyId: string, attachmentId: string) {
    const row = await this.requireOwned(companyId, attachmentId);
    if (row.isArchived) throw new AppError(409, 'الملف مؤرشف');
    const key = row.storagePathKey || row.storagePath;
    assertTenantKey(companyId, key);
    const presign = await this.storage.createPresignedDownload(
      key,
      row.originalFileName || row.fileName,
      PRESIGN_DOWNLOAD_SECONDS
    );
    return {
      attachment: toPublicAttachment(row),
      download: {
        url: this.storage.kind === 'LOCAL' ? `/api/v1/attachments/${row.id}/stream` : presign.url,
        expiresAt: presign.expiresAt,
      },
    };
  }

  async streamForCompany(companyId: string, attachmentId: string) {
    const row = await this.requireOwned(companyId, attachmentId);
    const key = row.storagePathKey || row.storagePath;
    assertTenantKey(companyId, key);
    const object = await this.storage.getObject(key);
    return {
      row,
      ...object,
    };
  }

  async archive(companyId: string, attachmentId: string) {
    const row = await this.requireOwned(companyId, attachmentId);
    const updated = await prisma.documentAttachment.update({
      where: { id: row.id },
      data: { isArchived: true },
    });
    return toPublicAttachment(updated);
  }

  async softDelete(companyId: string, attachmentId: string) {
    const row = await this.requireOwned(companyId, attachmentId);
    await prisma.documentAttachment.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), isArchived: true },
    });
    const key = row.storagePathKey || row.storagePath;
    if (key) await this.storage.delete(key);
    return { id: attachmentId, deleted: true };
  }

  private async requireOwned(companyId: string, attachmentId: string) {
    const row = await prisma.documentAttachment.findFirst({
      where: { id: attachmentId, companyId, deletedAt: null },
    });
    if (!row) throw new AppError(404, 'المرفق غير موجود');
    return row;
  }
}

export const documentAttachmentService = new DocumentAttachmentService();
