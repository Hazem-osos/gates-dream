-- Enterprise Sentinel cache: one snapshot per tenant for instant 06:00 opening.
-- No company FK — prior AI tables hit collation mismatches on companies.id.

CREATE TABLE IF NOT EXISTS `ai_sentinel_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'live',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_sentinel_snapshots_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;
