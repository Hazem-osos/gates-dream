-- Optional PostgreSQL sidecar for Gates AI RAG (VECTOR_DATABASE_URL).
-- Do not run against the MySQL ERP database.
-- IDs are TEXT so they match MySQL VARCHAR company/document ids (not always UUID-castable).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB,
    embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_company ON ai_document_chunks (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_document ON ai_document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_embedding
  ON ai_document_chunks
  USING hnsw (embedding vector_cosine_ops);
