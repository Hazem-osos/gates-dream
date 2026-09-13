import { randomUUID } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { ArchiveEntityType } from '../types/archive-entity.types';
import { isArchiveEntityType } from '../types/archive-entity.types';
import type { StorageProvider } from '../object-store/storage-provider';
import { buildTenantObjectKey, sanitizeFileName } from '../object-store/storage-provider';
import { resolveStorageProvider } from '../object-store/resolve-storage-provider';
import { licenseSubscriptionService } from '../../platform/services/license-subscription.service';
import { ENTITY_TYPE_TO_LINK } from '../types/document-attachment.types';

export interface UploadAttachmentInput {
  companyId: string;
  branchId?: string;
  entityType: ArchiveEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedById?: string;
  description?: string;
  tags?: string[];
}

export class DocumentArchiveService {
  constructor(private readonly storage: StorageProvider = resolveStorageProvider()) {}

  private async assertStorageQuota(companyId: string, additionalBytes: number) {
    const sub = await licenseSubscriptionService.getForCompany(companyId);
    if (!sub) return;

    const used = await prisma.documentAttachment.aggregate({
      where: { companyId, deletedAt: null },
      _sum: { fileSize: true },
    });
    const usedBytes = Number(used._sum.fileSize ?? 0);
    const limitBytes = sub.maxStorageMb * 1024 * 1024;
    if (usedBytes + additionalBytes > limitBytes) {
      throw new AppError(422, 'Archive storage quota exceeded for this tenant');
    }
  }

  async upload(input: UploadAttachmentInput) {
    if (!isArchiveEntityType(input.entityType)) {
      throw new AppError(422, 'Invalid entityType');
    }
    await this.assertStorageQuota(input.companyId, input.buffer.length);

    const id = randomUUID();
    const storedFileName = sanitizeFileName(input.fileName);
    const storagePathKey = buildTenantObjectKey({
      companyId: input.companyId,
      attachmentId: id,
      storedFileName,
    });
    const stored = await this.storage.put({
      companyId: input.companyId,
      attachmentId: id,
      fileName: storedFileName,
      mimeType: input.mimeType,
      buffer: input.buffer,
      objectKey: storagePathKey,
    });

    const fileUrl = this.storage.resolvePublicUrl?.(stored.storagePath);
    const linkField = ENTITY_TYPE_TO_LINK[input.entityType];

    const row = await prisma.documentAttachment.create({
      data: {
        id,
        companyId: input.companyId,
        branchId: input.branchId,
        entityType: input.entityType,
        entityId: input.entityId,
        originalFileName: input.fileName,
        storedFileName,
        fileName: input.fileName,
        storagePath: stored.storagePath,
        storagePathKey: stored.storagePath,
        storageProvider: this.storage.kind,
        fileUrl,
        fileSize: input.buffer.length,
        mimeType: input.mimeType,
        description: input.description,
        tags: input.tags?.length ? input.tags : undefined,
        uploadedById: input.uploadedById,
        uploadedByUserId: input.uploadedById ?? '',
        ...(linkField ? { [linkField]: input.entityId } : {}),
      },
    });

    return row;
  }

  async listForEntity(companyId: string, entityType: string, entityId: string) {
    if (!isArchiveEntityType(entityType)) {
      throw new AppError(422, 'Invalid entityType');
    }
    return prisma.documentAttachment.findMany({
      where: {
        companyId,
        entityType,
        entityId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async softDelete(companyId: string, attachmentId: string) {
    const row = await prisma.documentAttachment.findFirst({
      where: { id: attachmentId, companyId, deletedAt: null },
    });
    if (!row) throw new AppError(404, 'Attachment not found');

    await prisma.documentAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
    await this.storage.delete(row.storagePath);
    return { id: attachmentId, deleted: true };
  }
}

export const documentArchiveService = new DocumentArchiveService();
