CREATE TABLE `migration_stored_packages` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `storedPath` VARCHAR(512) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `migration_stored_packages_companyId_idx`(`companyId`),
    INDEX `migration_stored_packages_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
