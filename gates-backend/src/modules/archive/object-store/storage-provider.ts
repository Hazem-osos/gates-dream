export type StorageProviderKind = 'S3' | 'MINIO' | 'R2' | 'LOCAL';

export interface StoredObject {
  storagePath: string;
  fileUrl?: string;
}

export interface StoragePutInput {
  companyId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  /** When set, used as the exact object key / relative disk path. */
  objectKey?: string;
}

export interface PresignedUploadResult {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
  /** Present for LOCAL ticket uploads that must hit the API, not the object store. */
  uploadToken?: string;
}

export interface PresignedDownloadResult {
  url: string;
  expiresAt: string;
}

export interface StoredObjectStream {
  body: NodeJS.ReadableStream | Uint8Array | Buffer;
  contentType?: string;
  contentLength?: number;
}

export interface StorageProvider {
  readonly kind: StorageProviderKind;
  put(input: StoragePutInput): Promise<StoredObject>;
  delete(storagePath: string): Promise<void>;
  resolvePublicUrl?(storagePath: string): string | undefined;
  createPresignedUpload(
    storagePath: string,
    mimeType: string,
    expiresSeconds: number
  ): Promise<PresignedUploadResult>;
  createPresignedDownload(
    storagePath: string,
    fileName: string,
    expiresSeconds: number
  ): Promise<PresignedDownloadResult>;
  headObject?(storagePath: string): Promise<{ contentLength: number; contentType?: string } | null>;
  getObject(storagePath: string): Promise<StoredObjectStream>;
}

export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || 'file';
  return base.replace(/[^\w.\-()]+/g, '_').slice(0, 180);
}

export function buildTenantObjectKey(input: {
  companyId: string;
  attachmentId: string;
  storedFileName: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${input.companyId}/${yyyy}/${mm}/${input.attachmentId}/${sanitizeFileName(input.storedFileName)}`;
}

export function assertTenantKey(companyId: string, storagePath: string): void {
  if (!storagePath.startsWith(`${companyId}/`)) {
    throw new Error('Storage key is not isolated to the requesting tenant');
  }
}
