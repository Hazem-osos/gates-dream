import type {
  PresignedDownloadResult,
  PresignedUploadResult,
  StorageProvider,
  StorageProviderKind,
  StoragePutInput,
  StoredObject,
  StoredObjectStream,
} from './storage-provider';

type S3Module = typeof import('@aws-sdk/client-s3');
type PresignerModule = typeof import('@aws-sdk/s3-request-presigner');

let s3Module: S3Module | null = null;
let presignerModule: PresignerModule | null = null;

async function loadS3(): Promise<S3Module> {
  if (s3Module) return s3Module;
  try {
    s3Module = await import('@aws-sdk/client-s3');
    return s3Module;
  } catch {
    throw new Error(
      'Object storage requires @aws-sdk/client-s3 (npm install @aws-sdk/client-s3)'
    );
  }
}

async function loadPresigner(): Promise<PresignerModule> {
  if (presignerModule) return presignerModule;
  try {
    presignerModule = await import('@aws-sdk/s3-request-presigner');
    return presignerModule;
  } catch {
    throw new Error(
      'Presigned URLs require @aws-sdk/s3-request-presigner (npm install @aws-sdk/s3-request-presigner)'
    );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} for object storage`);
  return value;
}

function detectKind(): StorageProviderKind {
  const mode = process.env.ARCHIVE_STORAGE_PROVIDER?.trim().toLowerCase() ?? '';
  if (mode === 'minio') return 'MINIO';
  if (mode === 'r2') return 'R2';
  const endpoint = process.env.ARCHIVE_S3_ENDPOINT?.trim().toLowerCase() ?? '';
  if (endpoint.includes('r2.cloudflarestorage.com')) return 'R2';
  if (endpoint && !endpoint.includes('amazonaws.com')) return 'MINIO';
  return 'S3';
}

/**
 * S3-compatible object storage (AWS, MinIO, Cloudflare R2).
 * Keys are always `{companyId}/{yyyy}/{mm}/{attachmentId}/{safeFileName}`.
 */
export class S3StorageProvider implements StorageProvider {
  readonly kind: StorageProviderKind = detectKind();
  private client: InstanceType<S3Module['S3Client']> | null = null;

  private async clientOrCreate() {
    if (this.client) return this.client;
    const { S3Client } = await loadS3();
    const endpoint = process.env.ARCHIVE_S3_ENDPOINT?.trim();
    const forcePathStyle = process.env.ARCHIVE_S3_FORCE_PATH_STYLE === 'true';
    this.client = new S3Client({
      region: requireEnv('ARCHIVE_S3_REGION'),
      endpoint: endpoint || undefined,
      forcePathStyle: forcePathStyle || Boolean(endpoint),
      credentials: {
        accessKeyId: requireEnv('ARCHIVE_S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('ARCHIVE_S3_SECRET_ACCESS_KEY'),
      },
    });
    return this.client;
  }

  private bucket(): string {
    return requireEnv('ARCHIVE_S3_BUCKET');
  }

  async put(input: StoragePutInput): Promise<StoredObject> {
    const { PutObjectCommand } = await loadS3();
    const client = await this.clientOrCreate();
    const Key =
      input.objectKey ??
      (input.fileName.includes('/')
        ? input.fileName
        : `${input.companyId}/${input.attachmentId}/${input.fileName.replace(/[^\w.\-()]+/g, '_')}`);
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key,
        Body: input.buffer,
        ContentType: input.mimeType,
      })
    );
    return { storagePath: Key, fileUrl: undefined };
  }

  async putAtKey(storagePath: string, mimeType: string, buffer: Buffer): Promise<StoredObject> {
    const { PutObjectCommand } = await loadS3();
    const client = await this.clientOrCreate();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: storagePath,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return { storagePath };
  }

  async delete(storagePath: string): Promise<void> {
    const { DeleteObjectCommand } = await loadS3();
    const client = await this.clientOrCreate();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: storagePath }));
  }

  async createPresignedUpload(
    storagePath: string,
    mimeType: string,
    expiresSeconds: number
  ): Promise<PresignedUploadResult> {
    const { PutObjectCommand } = await loadS3();
    const { getSignedUrl } = await loadPresigner();
    const client = await this.clientOrCreate();
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: storagePath,
        ContentType: mimeType,
      }),
      { expiresIn: expiresSeconds }
    );
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      expiresAt,
    };
  }

  async createPresignedDownload(
    storagePath: string,
    fileName: string,
    expiresSeconds: number
  ): Promise<PresignedDownloadResult> {
    const { GetObjectCommand } = await loadS3();
    const { getSignedUrl } = await loadPresigner();
    const client = await this.clientOrCreate();
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: storagePath,
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"`,
      }),
      { expiresIn: expiresSeconds }
    );
    return { url, expiresAt };
  }

  async headObject(storagePath: string): Promise<{ contentLength: number; contentType?: string } | null> {
    const { HeadObjectCommand } = await loadS3();
    const client = await this.clientOrCreate();
    try {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket(), Key: storagePath })
      );
      return {
        contentLength: Number(result.ContentLength ?? 0),
        contentType: result.ContentType,
      };
    } catch {
      return null;
    }
  }

  async getObject(storagePath: string): Promise<StoredObjectStream> {
    const { GetObjectCommand } = await loadS3();
    const client = await this.clientOrCreate();
    const result = await client.send(
      new GetObjectCommand({ Bucket: this.bucket(), Key: storagePath })
    );
    if (!result.Body) {
      throw new Error('Object body is empty');
    }
    return {
      body: result.Body as NodeJS.ReadableStream,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }
}

export const s3StorageProvider = new S3StorageProvider();
