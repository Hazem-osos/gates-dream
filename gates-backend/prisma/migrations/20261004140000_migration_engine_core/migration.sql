-- Phase 1: Legacy migration engine core tables (local dev only — do not deploy to production yet)

CREATE TABLE `migration_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `targetCompanyId` VARCHAR(191) NOT NULL,
    `legacyCompanyCode` VARCHAR(20) NOT NULL,
    `sourceType` VARCHAR(40) NOT NULL,
    `sourceFingerprint` VARCHAR(128) NOT NULL,
    `sourceDatabaseName` VARCHAR(128) NULL,
    `status` VARCHAR(32) NOT NULL,
    `currentStage` VARCHAR(64) NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT false,
    `legacyConnectionRef` VARCHAR(64) NULL,
    `reconciliationBaseline` JSON NULL,
    `progress` JSON NULL,
    `lockToken` VARCHAR(64) NULL,
    `lockExpiresAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `migration_jobs_targetCompanyId_idx`(`targetCompanyId`),
    INDEX `migration_jobs_status_idx`(`status`),
    INDEX `migration_jobs_sourceFingerprint_idx`(`sourceFingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_id_maps` (
    `id` VARCHAR(191) NOT NULL,
    `migrationJobId` VARCHAR(191) NOT NULL,
    `sourceEntity` VARCHAR(64) NOT NULL,
    `sourceKey` TEXT NOT NULL,
    `sourceKeyHash` VARCHAR(64) NOT NULL,
    `targetModel` VARCHAR(64) NOT NULL,
    `targetId` VARCHAR(36) NOT NULL,
    `outcome` VARCHAR(32) NOT NULL,
    `readOnly` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `migration_id_maps_migrationJobId_sourceEntity_sourceKeyHash_key`(`migrationJobId`, `sourceEntity`, `sourceKeyHash`),
    INDEX `migration_id_maps_migrationJobId_targetModel_targetId_idx`(`migrationJobId`, `targetModel`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_checkpoints` (
    `id` VARCHAR(191) NOT NULL,
    `migrationJobId` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(64) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `cursorKey` VARCHAR(255) NULL,
    `processedCount` BIGINT NOT NULL DEFAULT 0,
    `successCount` BIGINT NOT NULL DEFAULT 0,
    `warningCount` BIGINT NOT NULL DEFAULT 0,
    `errorCount` BIGINT NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `migration_checkpoints_migrationJobId_stage_entity_key`(`migrationJobId`, `stage`, `entity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_issues` (
    `id` VARCHAR(191) NOT NULL,
    `migrationJobId` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(64) NULL,
    `severity` VARCHAR(16) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `sourceEntity` VARCHAR(64) NULL,
    `sourceKey` TEXT NULL,
    `description` TEXT NOT NULL,
    `resolutionState` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `migration_issues_migrationJobId_severity_idx`(`migrationJobId`, `severity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `migration_id_maps` ADD CONSTRAINT `migration_id_maps_migrationJobId_fkey` FOREIGN KEY (`migrationJobId`) REFERENCES `migration_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `migration_checkpoints` ADD CONSTRAINT `migration_checkpoints_migrationJobId_fkey` FOREIGN KEY (`migrationJobId`) REFERENCES `migration_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `migration_issues` ADD CONSTRAINT `migration_issues_migrationJobId_fkey` FOREIGN KEY (`migrationJobId`) REFERENCES `migration_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
