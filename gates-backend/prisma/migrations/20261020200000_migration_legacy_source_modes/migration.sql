-- Legacy source modes: per-tenant config, connector, bak restore lifecycle
ALTER TABLE `migration_jobs` ADD COLUMN `sourceMode` VARCHAR(32) NULL;
ALTER TABLE `migration_jobs` ADD COLUMN `legacySourceConfigId` VARCHAR(36) NULL;
CREATE INDEX `migration_jobs_legacySourceConfigId_idx` ON `migration_jobs`(`legacySourceConfigId`);

CREATE TABLE `migration_legacy_source_configs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(32) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    `configEncrypted` TEXT NOT NULL,
    `fingerprint` VARCHAR(128) NULL,
    `databaseName` VARCHAR(128) NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastTestOk` BOOLEAN NULL,
    `lastTestMessage` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `migration_legacy_source_configs_companyId_mode_key`(`companyId`, `mode`),
    INDEX `migration_legacy_source_configs_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_legacy_source_audits` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `mode` VARCHAR(32) NULL,
    `actorId` VARCHAR(64) NULL,
    `detail` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `migration_legacy_source_audits_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_connector_devices` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `connectorVersion` VARCHAR(32) NULL,
    `lastHeartbeatAt` DATETIME(3) NULL,
    `lastError` VARCHAR(512) NULL,
    `pairedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `migration_connector_devices_tokenHash_key`(`tokenHash`),
    INDEX `migration_connector_devices_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_connector_pairing_codes` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `migration_connector_pairing_codes_companyId_idx`(`companyId`),
    INDEX `migration_connector_pairing_codes_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_connector_commands` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `migrationJobId` VARCHAR(191) NULL,
    `operation` VARCHAR(64) NOT NULL,
    `payloadJson` JSON NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `resultJson` JSON NULL,
    `errorMessage` VARCHAR(1024) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    INDEX `migration_connector_commands_companyId_status_idx`(`companyId`, `status`),
    INDEX `migration_connector_commands_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `migration_bak_restore_runs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `migrationJobId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'UPLOADED',
    `legacySourceConfigId` VARCHAR(191) NULL,
    `restoredDatabaseName` VARCHAR(128) NULL,
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `diagnosticsJson` JSON NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `migration_bak_restore_runs_companyId_idx`(`companyId`),
    INDEX `migration_bak_restore_runs_status_idx`(`status`),
    INDEX `migration_bak_restore_runs_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
