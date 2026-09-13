import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiDocumentCategory } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { estimateTokenCount, splitIntoChunks } from './chunk-text';
import { embedTexts } from './embeddings';
import { extractDocumentText } from './extract-text';
import { isPgVectorConfigured, upsertPgChunk } from './pg-vector.store';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);
const MAX_BYTES = 15 * 1024 * 1024;
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'ai-documents');

export const DOCUMENT_CATEGORIES = [
  'CONTRACT',
  'BOQ_SPECIFICATION',
  'HR_POLICY',
  'COMPANY_BYLAW',
  'TAX_REGULATION',
  'OTHER',
] as const;

export type IngestDocumentInput = {
  companyId: string;
  uploadedById: string;
  title?: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  category?: string;
  referenceId?: string;
};

function asCategory(value?: string): AiDocumentCategory {
  const key = (value ?? 'CONTRACT').toUpperCase();
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(key)
    ? (key as AiDocumentCategory)
    : AiDocumentCategory.CONTRACT;
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\u0600-\u06FF()-]+/g, '_').slice(0, 180) || 'document';
}

export class DocumentIngestionService {
  async ingest(input: IngestDocumentInput) {
    if (!input.buffer?.length) throw new AppError(400, 'لم يتم رفع ملف');
    if (input.buffer.length > MAX_BYTES) throw new AppError(413, 'حجم الملف يتجاوز 15 ميجابايت');
    const mime = input.mimeType || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mime) && !input.fileName.match(/\.(pdf|txt|md)$/i)) {
      throw new AppError(415, 'يُسمح بملفات PDF أو النص أو Markdown فقط');
    }

    let text: string;
    try {
      text = await extractDocumentText({
        buffer: input.buffer,
        mimeType: mime,
        fileName: input.fileName,
      });
    } catch (error) {
      throw new AppError(422, error instanceof Error ? error.message : 'تعذّر استخراج النص من الملف');
    }
    const chunks = splitIntoChunks(text);
    if (!chunks.length) throw new AppError(422, 'الملف لا يحتوي على نص قابل للفهرسة');

    const embeddings = await embedTexts(chunks);
    const documentId = randomUUID();
    const fileName = safeFileName(input.fileName);
    const relative = path.posix.join(input.companyId, documentId, fileName);
    const absolute = path.join(STORAGE_ROOT, input.companyId, documentId, fileName);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.buffer);

    const category = asCategory(input.category);
    const title = input.title?.trim() || fileName.replace(/\.[^.]+$/, '');

    const document = await prisma.aiDocument.create({
      data: {
        id: documentId,
        companyId: input.companyId,
        uploadedById: input.uploadedById,
        title,
        fileName,
        fileUrl: `/storage/ai-documents/${relative}`,
        fileSize: input.buffer.length,
        mimeType: mime,
        category,
        referenceId: input.referenceId?.trim() || null,
        totalChunks: chunks.length,
        chunks: {
          create: chunks.map((content, index) => ({
            id: randomUUID(),
            companyId: input.companyId,
            chunkIndex: index,
            content,
            tokenCount: estimateTokenCount(content),
            metadata: {
              page: guessPage(content),
              section: guessSection(content),
              chunkIndex: index,
            },
            embedding: embeddings[index],
          })),
        },
      },
      include: { chunks: { select: { id: true, chunkIndex: true, tokenCount: true, metadata: true, embedding: true, content: true } } },
    });

    if (isPgVectorConfigured()) {
      try {
        for (const chunk of document.chunks) {
          const embedding = Array.isArray(chunk.embedding)
            ? chunk.embedding.map((n) => Number(n))
            : embeddings[chunk.chunkIndex];
          await upsertPgChunk({
            id: chunk.id,
            documentId: document.id,
            companyId: input.companyId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            metadata: chunk.metadata,
            embedding,
          });
        }
      } catch (error) {
        logger.warn({ error, documentId }, 'pgvector upsert failed; MySQL embeddings remain');
      }
    }

    return {
      id: document.id,
      title: document.title,
      category: document.category,
      totalChunks: document.totalChunks,
      fileName: document.fileName,
      referenceId: document.referenceId,
      vectorStore: isPgVectorConfigured() ? 'pgvector' : 'mysql-json',
    };
  }

  list(companyId: string) {
    return prisma.aiDocument.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileName: true,
        category: true,
        referenceId: true,
        totalChunks: true,
        createdAt: true,
      },
      take: 50,
    });
  }
}

function guessSection(content: string): string | undefined {
  const line = content.split('\n').find((row) => /المادة|#{1,3}\s/.test(row));
  return line?.trim().slice(0, 160);
}

function guessPage(content: string): number | undefined {
  const match = content.match(/(?:صفحة|page)\s*[:.]?\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

export const documentIngestionService = new DocumentIngestionService();
