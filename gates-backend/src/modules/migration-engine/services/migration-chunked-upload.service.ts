import { createHash, randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import prisma from '../../../shared/database/prisma';
import {
  assertAllowedBackupFilename,
  ensureCompanyPackageDir,
  finalizeUploadedPackage,
} from './migration-package.storage';
import { migrationChunkMaxBytes, migrationPackageMaxBytes } from '../migration-engine-config';

type ChunkSession = {
  id: string;
  companyId: string;
  originalName: string;
  totalChunks: number;
  received: Set<number>;
  chunkHashes: Map<number, string>;
  tempPath: string;
  createdAt: number;
};

/** Process-local cache; rehydrated from DB after restart. */
const sessions = new Map<string, ChunkSession>();

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

/** @internal test hook — simulates API restart (memory lost, DB retained). */
export function __testOnlyClearUploadSessionCache() {
  sessions.clear();
}

async function purgeExpiredUploadSessions() {
  const now = new Date();
  const expired = await prisma.migrationPackageUploadSession.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, tempPath: true },
    take: 200,
  });
  for (const row of expired) {
    sessions.delete(row.id);
    await fsp.unlink(row.tempPath).catch(() => undefined);
    await prisma.migrationPackageUploadSession.delete({ where: { id: row.id } }).catch(() => undefined);
  }
}

async function hydrateSession(uploadId: string, companyId: string): Promise<ChunkSession | null> {
  const row = await prisma.migrationPackageUploadSession.findFirst({
    where: { id: uploadId, companyId },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    sessions.delete(uploadId);
    await fsp.unlink(row.tempPath).catch(() => undefined);
    await prisma.migrationPackageUploadSession.delete({ where: { id: uploadId } }).catch(() => undefined);
    return null;
  }
  const chunks = await prisma.migrationPackageUploadChunk.findMany({
    where: { sessionId: uploadId },
    select: { chunkIndex: true, sha256: true },
  });
  const received = new Set<number>();
  const chunkHashes = new Map<number, string>();
  for (const c of chunks) {
    received.add(c.chunkIndex);
    chunkHashes.set(c.chunkIndex, c.sha256);
  }
  return {
    id: row.id,
    companyId: row.companyId,
    originalName: row.originalName,
    totalChunks: row.totalChunks,
    received,
    chunkHashes,
    tempPath: row.tempPath,
    createdAt: row.createdAt.getTime(),
  };
}

async function getSession(uploadId: string, companyId: string): Promise<ChunkSession | null> {
  const cached = sessions.get(uploadId);
  if (cached && cached.companyId === companyId) return cached;
  const hydrated = await hydrateSession(uploadId, companyId);
  if (hydrated) sessions.set(uploadId, hydrated);
  return hydrated;
}

async function deleteSession(uploadId: string) {
  sessions.delete(uploadId);
  await prisma.migrationPackageUploadSession.delete({ where: { id: uploadId } }).catch(() => undefined);
}

export async function initChunkedUpload(params: {
  companyId: string;
  originalName: string;
  totalChunks: number;
}) {
  await purgeExpiredUploadSessions();
  assertAllowedBackupFilename(params.originalName);
  if (params.totalChunks < 1 || params.totalChunks > 10_000) {
    throw new Error('totalChunks out of range');
  }
  const id = randomUUID();
  const dir = await ensureCompanyPackageDir(params.companyId);
  const tempPath = path.join(dir, `chunk-${id}.part`);
  await fsp.writeFile(tempPath, Buffer.alloc(0));
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.migrationPackageUploadSession.create({
    data: {
      id,
      companyId: params.companyId,
      originalName: params.originalName,
      totalChunks: params.totalChunks,
      tempPath,
      expiresAt,
    },
  });
  const session: ChunkSession = {
    id,
    companyId: params.companyId,
    originalName: params.originalName,
    totalChunks: params.totalChunks,
    received: new Set(),
    chunkHashes: new Map(),
    tempPath,
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return { uploadId: id };
}

export async function appendUploadChunk(params: {
  companyId: string;
  uploadId: string;
  index: number;
  data: Buffer;
}) {
  await purgeExpiredUploadSessions();
  const session = await getSession(params.uploadId, params.companyId);
  if (!session) {
    throw new Error('Unknown upload session');
  }
  if (params.index < 0 || params.index >= session.totalChunks) {
    throw new Error('Invalid chunk index');
  }
  if (params.data.length > migrationChunkMaxBytes()) {
    throw new Error('Chunk exceeds maximum allowed size');
  }
  let already = 0;
  try {
    already = (await fsp.stat(session.tempPath)).size;
  } catch {
    already = 0;
  }
  if (!session.received.has(params.index) && already + params.data.length > migrationPackageMaxBytes()) {
    throw new Error(
      `Backup exceeds MIGRATION_UPLOAD_MAX_MB (${Math.floor(migrationPackageMaxBytes() / (1024 * 1024))} MB). Resize storage before raising the cap.`
    );
  }
  try {
    const space = await fsp.statfs(path.dirname(session.tempPath));
    const free = Number(space.bavail) * Number(space.bsize);
    if (!session.received.has(params.index) && params.data.length > free) {
      throw new Error('Not enough free disk on the upload volume for this chunk.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Not enough free disk')) throw err;
  }
  const chunkHash = createHash('sha256').update(params.data).digest('hex');
  const priorHash = session.chunkHashes.get(params.index);
  if (session.received.has(params.index)) {
    if (priorHash !== chunkHash) {
      throw new Error(`Chunk ${params.index} already received with different content`);
    }
    return {
      uploadId: params.uploadId,
      received: session.received.size,
      totalChunks: session.totalChunks,
      percent: Math.round((session.received.size / session.totalChunks) * 100),
      duplicate: true,
    };
  }

  const existingRow = await prisma.migrationPackageUploadChunk.findUnique({
    where: {
      sessionId_chunkIndex: { sessionId: params.uploadId, chunkIndex: params.index },
    },
  });
  if (existingRow) {
    if (existingRow.sha256 !== chunkHash) {
      throw new Error(`Chunk ${params.index} already received with different content`);
    }
    session.received.add(params.index);
    session.chunkHashes.set(params.index, chunkHash);
    return {
      uploadId: params.uploadId,
      received: session.received.size,
      totalChunks: session.totalChunks,
      percent: Math.round((session.received.size / session.totalChunks) * 100),
      duplicate: true,
    };
  }

  await fsp.appendFile(session.tempPath, params.data);
  await prisma.migrationPackageUploadChunk.create({
    data: {
      id: randomUUID(),
      sessionId: params.uploadId,
      chunkIndex: params.index,
      sha256: chunkHash,
    },
  });
  session.received.add(params.index);
  session.chunkHashes.set(params.index, chunkHash);
  return {
    uploadId: params.uploadId,
    received: session.received.size,
    totalChunks: session.totalChunks,
    percent: Math.round((session.received.size / session.totalChunks) * 100),
  };
}

export async function completeChunkedUpload(params: { companyId: string; uploadId: string }) {
  await purgeExpiredUploadSessions();
  const session = await getSession(params.uploadId, params.companyId);
  if (!session) {
    throw new Error('Unknown upload session');
  }
  if (session.received.size !== session.totalChunks) {
    throw new Error(`Missing chunks: ${session.received.size}/${session.totalChunks}`);
  }
  const stored = await finalizeUploadedPackage({
    companyId: params.companyId,
    tempPath: session.tempPath,
    originalName: session.originalName,
  });
  await deleteSession(params.uploadId);
  return stored;
}

export async function abortChunkedUpload(params: { companyId: string; uploadId: string }) {
  await purgeExpiredUploadSessions();
  const session = await getSession(params.uploadId, params.companyId);
  if (!session) {
    throw new Error('Unknown upload session');
  }
  await deleteSession(params.uploadId);
  await fsp.unlink(session.tempPath).catch(() => undefined);
  return { aborted: true, uploadId: params.uploadId };
}
