import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { env } from '../../../shared/config/env';
import { logger } from '../../../shared/logger';
import { toVectorLiteral } from './vector-math';

const require = createRequire(import.meta.url);

export type PgSearchHit = {
  id: string;
  documentId: string;
  content: string;
  metadata: unknown;
  similarity: number;
};

type PgClient = {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

function vectorUrl(): string | undefined {
  return env.VECTOR_DATABASE_URL?.trim() || undefined;
}

export function isPgVectorConfigured(): boolean {
  return Boolean(vectorUrl());
}

function loadPgClient(): new (config: { connectionString: string }) => PgClient {
  try {
    const mod = require('pg') as { Client: new (config: { connectionString: string }) => PgClient };
    return mod.Client;
  } catch {
    throw new Error('Install the `pg` package to use VECTOR_DATABASE_URL');
  }
}

async function withClient<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const url = vectorUrl();
  if (!url) throw new Error('VECTOR_DATABASE_URL is not set');
  const Client = loadPgClient();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) =>
      part
        .split('\n')
        .map((line) => line.replace(/--.*$/, '').trimEnd())
        .join('\n')
        .trim()
    )
    .filter(Boolean);
}

let bootstrapped = false;

export async function ensurePgVectorSchema(): Promise<void> {
  if (!isPgVectorConfigured() || bootstrapped) return;
  try {
    const sqlPath = path.resolve(process.cwd(), 'prisma/vector/pgvector.sql');
    const sql = await readFile(sqlPath, 'utf8');
    await withClient(async (client) => {
      for (const statement of splitSqlStatements(sql)) {
        await client.query(statement);
      }
    });
    bootstrapped = true;
  } catch (error) {
    logger.warn({ error }, 'pgvector schema bootstrap skipped; MySQL JSON embeddings remain');
  }
}

export async function upsertPgChunk(input: {
  id: string;
  documentId: string;
  companyId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: unknown;
  embedding: number[];
}): Promise<void> {
  if (!isPgVectorConfigured()) return;
  await ensurePgVectorSchema();
  if (!bootstrapped) return;
  const vector = toVectorLiteral(input.embedding);
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO ai_document_chunks
        (id, document_id, company_id, chunk_index, content, token_count, metadata, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         embedding = EXCLUDED.embedding,
         metadata = EXCLUDED.metadata`,
      [
        input.id,
        input.documentId,
        input.companyId,
        input.chunkIndex,
        input.content,
        input.tokenCount,
        JSON.stringify(input.metadata ?? {}),
        vector,
      ]
    );
  });
}

export async function searchPgChunks(input: {
  companyId: string;
  embedding: number[];
  topK: number;
  minSimilarity?: number;
}): Promise<PgSearchHit[]> {
  if (!isPgVectorConfigured()) return [];
  await ensurePgVectorSchema();
  if (!bootstrapped) return [];
  const min = input.minSimilarity ?? 0.65;
  const vector = toVectorLiteral(input.embedding);
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, document_id AS "documentId", content, metadata,
              1 - (embedding <=> $1::vector) AS similarity
         FROM ai_document_chunks
        WHERE company_id = $2
          AND (1 - (embedding <=> $1::vector)) > $3
        ORDER BY similarity DESC
        LIMIT $4`,
      [vector, input.companyId, min, input.topK]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      documentId: String(row.documentId),
      content: String(row.content),
      metadata: row.metadata,
      similarity: Number(row.similarity),
    }));
  });
}

export async function deletePgChunksForDocument(documentId: string, companyId: string): Promise<void> {
  if (!isPgVectorConfigured()) return;
  try {
    await withClient(async (client) => {
      await client.query(`DELETE FROM ai_document_chunks WHERE document_id = $1 AND company_id = $2`, [
        documentId,
        companyId,
      ]);
    });
  } catch (error) {
    logger.warn({ error, documentId }, 'pgvector delete skipped');
  }
}
