-- Durable migration package chunked upload sessions (survive API restarts).

CREATE TABLE `migration_package_upload_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `totalChunks` INTEGER NOT NULL,
    `tempPath` VARCHAR(512) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `migration_package_upload_sessions_companyId_idx`(`companyId`),
    INDEX `migration_package_upload_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_package_upload_chunks` (
    `id` VARCHAR(36) NOT NULL,
    `sessionId` VARCHAR(36) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `migration_package_upload_chunks_sessionId_chunkIndex_key`(`sessionId`, `chunkIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `migration_package_upload_chunks` ADD CONSTRAINT `migration_package_upload_chunks_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `migration_package_upload_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
