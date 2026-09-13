-- Gates AI Phase 4: proactive CFO insights (MySQL).
-- No company FK — prior AI tables hit collation mismatches on companies.id.

CREATE TABLE IF NOT EXISTS `ai_insights` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `category` ENUM('CASH_FLOW_RISK', 'OVERDUE_RECEIVABLES', 'STOCK_RUNOUT', 'PROJECT_MARGIN_DROP', 'EXPENSE_ANOMALY') NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'WARNING',
    `title` VARCHAR(240) NOT NULL,
    `summary` TEXT NOT NULL,
    `deterministicData` JSON NOT NULL,
    `actionLink` VARCHAR(300) NULL,
    `isDismissed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `ai_insights_companyId_isDismissed_createdAt_idx`(`companyId`, `isDismissed`, `createdAt`),
    INDEX `ai_insights_companyId_category_idx`(`companyId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;
