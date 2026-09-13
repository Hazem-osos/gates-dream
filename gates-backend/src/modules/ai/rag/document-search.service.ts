import { AiDocumentCategory } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { embedTexts } from './embeddings';
import { isPgVectorConfigured, searchPgChunks } from './pg-vector.store';
import { asEmbedding, cosineSimilarity } from './vector-math';

export type DocumentSearchInput = {
  companyId: string;
  query: string;
  category?: AiDocumentCategory;
  referenceId?: string;
  topK?: number;
};

export type DocumentSearchHit = {
  documentId: string;
  documentTitle: string;
  fileName: string;
  category: string;
  content: string;
  similarity: number;
  page?: number;
  section?: string;
  citation: string;
};

const MIN_SIMILARITY = 0.65;

export class DocumentSearchService {
  async search(input: DocumentSearchInput): Promise<{ found: boolean; matches: DocumentSearchHit[] }> {
    const topK = Math.min(Math.max(input.topK ?? 4, 1), 12);
    const [queryEmbedding] = await embedTexts([input.query]);

    const hits = isPgVectorConfigured()
      ? await this.searchPg(input, queryEmbedding, topK)
      : await this.searchMysql(input, queryEmbedding, topK);

    return {
      found: hits.length > 0,
      matches: hits,
    };
  }

  private async hydrate(documentIds: string[], companyId: string) {
    const docs = await prisma.aiDocument.findMany({
      where: { id: { in: documentIds }, companyId },
      select: { id: true, title: true, fileName: true, category: true, referenceId: true },
    });
    return new Map(docs.map((doc) => [doc.id, doc]));
  }

  private toHit(
    doc: { id: string; title: string; fileName: string; category: string },
    content: string,
    similarity: number,
    metadata: unknown
  ): DocumentSearchHit {
    const meta = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
    const page = typeof meta.page === 'number' ? meta.page : undefined;
    const section = typeof meta.section === 'string' ? meta.section : undefined;
    const where = section || (page != null ? `صفحة ${page}` : undefined);
    return {
      documentId: doc.id,
      documentTitle: doc.title,
      fileName: doc.fileName,
      category: doc.category,
      content,
      similarity: Math.round(similarity * 1000) / 1000,
      page,
      section,
      citation: where ? `«${doc.title}» — ${where}` : `«${doc.title}»`,
    };
  }

  private async searchPg(input: DocumentSearchInput, embedding: number[], topK: number) {
    const raw = await searchPgChunks({
      companyId: input.companyId,
      embedding,
      topK: topK * 3,
      minSimilarity: MIN_SIMILARITY,
    });
    const docs = await this.hydrate(
      raw.map((row) => row.documentId),
      input.companyId
    );
    return raw
      .map((row) => {
        const doc = docs.get(row.documentId);
        if (!doc) return null;
        if (input.category && doc.category !== input.category) return null;
        if (input.referenceId && doc.referenceId !== input.referenceId) return null;
        return this.toHit(doc, row.content, row.similarity, row.metadata);
      })
      .filter((row): row is DocumentSearchHit => Boolean(row))
      .slice(0, topK);
  }

  private async searchMysql(input: DocumentSearchInput, embedding: number[], topK: number) {
    const documents = await prisma.aiDocument.findMany({
      where: {
        companyId: input.companyId,
        ...(input.category ? { category: input.category } : {}),
        ...(input.referenceId ? { referenceId: input.referenceId } : {}),
      },
      select: { id: true, title: true, fileName: true, category: true },
      take: 80,
    });
    if (!documents.length) return [];
    const allowed = new Map(documents.map((doc) => [doc.id, doc]));
    const chunks = await prisma.aiDocumentChunk.findMany({
      where: {
        companyId: input.companyId,
        documentId: { in: [...allowed.keys()] },
      },
      select: { documentId: true, content: true, metadata: true, embedding: true },
      take: 2000,
    });

    return chunks
      .map((chunk) => {
        const vector = asEmbedding(chunk.embedding);
        const doc = allowed.get(chunk.documentId);
        if (!vector || !doc) return null;
        const similarity = cosineSimilarity(embedding, vector);
        if (similarity <= MIN_SIMILARITY) return null;
        return this.toHit(doc, chunk.content, similarity, chunk.metadata);
      })
      .filter((row): row is DocumentSearchHit => Boolean(row))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

export const documentSearchService = new DocumentSearchService();
