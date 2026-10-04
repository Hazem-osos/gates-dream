-- Owner-approved legacy GL account corrections (not inferred COA rows)

CREATE TABLE `legacy_account_overrides` (
    `id` VARCHAR(191) NOT NULL,
    `targetCompanyId` VARCHAR(191) NOT NULL,
    `sourceCompanyCode` VARCHAR(20) NOT NULL,
    `legacyAccountCode` VARCHAR(32) NOT NULL,
    `targetLegacyAccountCode` VARCHAR(32) NOT NULL,
    `targetAccountId` VARCHAR(36) NULL,
    `decisionType` VARCHAR(64) NOT NULL,
    `mappingClassification` VARCHAR(64) NOT NULL,
    `reason` TEXT NOT NULL,
    `approvedBy` VARCHAR(128) NOT NULL,
    `approvedAt` DATETIME(3) NOT NULL,
    `evidenceReference` VARCHAR(512) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `legacy_account_overrides_scope_key`(`targetCompanyId`, `sourceCompanyCode`, `legacyAccountCode`),
    INDEX `legacy_account_overrides_targetCompanyId_idx`(`targetCompanyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
