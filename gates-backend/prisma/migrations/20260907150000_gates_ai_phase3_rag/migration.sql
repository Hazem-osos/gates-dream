-- Gates AI Phase 3: company-scoped document corpus for RAG.
-- Primary ERP DB is MySQL — embeddings stored as JSON (1536 floats).
-- Optional pgvector sidecar: prisma/vector/pgvector.sql + VECTOR_DATABASE_URL.

CREATE TABLE IF NOT EXISTS `ai_documents` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `fileName` VARCHAR(240) NOT NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `category` ENUM('CONTRACT', 'BOQ_SPECIFICATION', 'HR_POLICY', 'COMPANY_BYLAW', 'TAX_REGULATION', 'OTHER') NOT NULL DEFAULT 'CONTRACT',
    `referenceId` VARCHAR(191) NULL,
    `totalChunks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_documents_companyId_category_idx`(`companyId`, `category`),
    INDEX `ai_documents_companyId_referenceId_idx`(`companyId`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_document_chunks` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `tokenCount` INTEGER NOT NULL,
    `metadata` JSON NULL,
    `embedding` JSON NULL,

    INDEX `ai_document_chunks_companyId_idx`(`companyId`),
    INDEX `ai_document_chunks_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `ai_document_chunks`
  ADD CONSTRAINT `ai_document_chunks_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `ai_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
