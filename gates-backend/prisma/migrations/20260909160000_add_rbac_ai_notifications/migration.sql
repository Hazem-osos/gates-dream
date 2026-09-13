-- Gates AI Proactive Sentinel notifications with RBAC audience isolation.
-- target_roles is JSON string[] because MySQL has no Prisma scalar lists.

CREATE TABLE IF NOT EXISTS `ai_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `targetRoles` JSON NOT NULL,
    `category` ENUM('FINANCIAL_LIQUIDITY', 'PROFIT_ANOMALY', 'CHEQUE_DUE', 'TAX_COMPLIANCE', 'STOCK_REORDER', 'EXPIRING_BATCH', 'SALES_AUDIT', 'UNPOSTED_DRAFTS') NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `titleAr` VARCHAR(240) NOT NULL,
    `messageAr` TEXT NOT NULL,
    `actionUrl` VARCHAR(300) NULL,
    `actionLabelAr` VARCHAR(120) NULL,
    `metadata` JSON NULL,
    `fingerprint` VARCHAR(160) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_notifications_companyId_createdAt_idx`(`companyId`, `createdAt`),
    INDEX `ai_notifications_companyId_isRead_idx`(`companyId`, `isRead`),
    INDEX `ai_notifications_companyId_fingerprint_idx`(`companyId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
