import { createReadStream } from 'node:fs';
import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  PresignedDownloadResult,
  PresignedUploadResult,
  StorageProvider,
  StoragePutInput,
  StoredObject,
  StoredObjectStream,
} from './storage-provider';
import { issueLocalUploadTicket } from './local-upload-tickets';

const DEFAULT_ROOT = path.resolve(process.cwd(), 'storage', 'archive');

export class LocalDiskStorageProvider implements StorageProvider {
  readonly kind = 'LOCAL' as const;

  constructor(private readonly rootDir: string = process.env.ARCHIVE_STORAGE_PATH ?? process.env.ARCHIVE_LOCAL_ROOT ?? DEFAULT_ROOT) {}

  private absolute(storagePath: string): string {
    const normalized = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const abs = path.join(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (!abs.startsWith(root)) {
      throw new Error('Rejected path traversal in local archive storage');
    }
    return abs;
  }

  async put(input: StoragePutInput): Promise<StoredObject> {
    const relative =
      input.objectKey ??
      (input.fileName.includes('/')
        ? input.fileName
        : path.join(input.companyId, input.attachmentId, input.fileName.replace(/[^\w.\-()]+/g, '_')));
    const posix = relative.replace(/\\/g, '/');
    const absolute = this.absolute(posix);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.buffer);
    return { storagePath: posix };
  }

  async putAtKey(storagePath: string, _mimeType: string, buffer: Buffer): Promise<StoredObject> {
    const absolute = this.absolute(storagePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, buffer);
    return { storagePath };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(this.absolute(storagePath));
    } catch {
      /* ignore missing file */
    }
  }

  resolvePublicUrl(storagePath: string): string | undefined {
    return `/api/v1/attachments/files/${encodeURIComponent(storagePath)}`;
  }

  async createPresignedUpload(
    storagePath: string,
    mimeType: string,
    expiresSeconds: number
  ): Promise<PresignedUploadResult> {
    const companyId = storagePath.split('/')[0] ?? '';
    const attachmentId = storagePath.split('/')[3] ?? storagePath.split('/')[1] ?? '';
    const ticket = issueLocalUploadTicket({
      attachmentId,
      companyId,
      storagePathKey: storagePath,
      mimeType,
      maxBytes: 50 * 1024 * 1024,
      ttlMs: expiresSeconds * 1000,
    });
    return {
      url: `/api/v1/attachments/${attachmentId}/bytes`,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'X-Upload-Token': ticket.token,
      },
      expiresAt: new Date(ticket.expiresAt).toISOString(),
      uploadToken: ticket.token,
    };
  }

  async createPresignedDownload(
    storagePath: string,
    _fileName: string,
    expiresSeconds: number
  ): Promise<PresignedDownloadResult> {
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    return {
      url: `/api/v1/attachments/files/${encodeURIComponent(storagePath)}`,
      expiresAt,
    };
  }

  async headObject(storagePath: string): Promise<{ contentLength: number; contentType?: string } | null> {
    try {
      const info = await stat(this.absolute(storagePath));
      if (!info.isFile()) return null;
      return { contentLength: info.size };
    } catch {
      return null;
    }
  }

  async getObject(storagePath: string): Promise<StoredObjectStream> {
    const abs = this.absolute(storagePath);
    const info = await stat(abs);
    return {
      body: createReadStream(abs),
      contentLength: info.size,
    };
  }
}

export const localDiskStorageProvider = new LocalDiskStorageProvider();
